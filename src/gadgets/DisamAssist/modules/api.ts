import type { BacklinkResult, BacklinkResult, PageData } from '../types';
import { config } from './config';
import { mergeUniqueTitles, normalizeTitle } from './wiki';

const api = new mw.Api();

const getPage = async (title: string): Promise<PageData | null> => {
    const response = await api.post({
        action: 'query',
        formatversion: 2,
        prop: 'revisions',
        rvprop: 'timestamp|content',
        curtimestamp: true,
        titles: title,
    });
    const page = response.query?.pages?.[0];

    if (!page || page.missing || page.invalid) {
        return null;
    }

    const revision = page.revisions?.[0];
    return {
        content: revision?.content ?? '',
        starttimestamp: page.starttimestamp ?? null,
        timestamp: revision?.timestamp ?? null,
    };
};

const getRedirectAliases = async (title: string): Promise<string[]> => {
    const aliases: string[] = [];
    let continuation: Record<string, string> = {};

    do {
        const response = await api.post({
            action: 'query',
            formatversion: 2,
            prop: 'redirects',
            rdlimit: 'max',
            rdnamespace: config.targetNamespace,
            titles: title,
            ...continuation,
        });
        const redirects = response.query?.pages?.[0]?.redirects ?? [];
        aliases.push(...redirects.map((redirect: { title: string }) => redirect.title));
        continuation = response.continue?.rdcontinue ? { rdcontinue: response.continue.rdcontinue } : {};
    } while (continuation.rdcontinue);

    return aliases;
};

const getBacklinks = async (title: string): Promise<string[]> => {
    const pages: string[] = [];
    let continuation: Record<string, string> = {};

    do {
        const response = await api.post({
            action: 'query',
            blcontinue: continuation.blcontinue,
            bllimit: 'max',
            blnamespace: config.targetNamespace,
            blredirect: true,
            formatversion: 2,
            list: 'backlinks',
            ...continuation,
            bltitle: title,
        });
        pages.push(...(response.query?.backlinks ?? []).map((page: { title: string }) => page.title));
        continuation = response.continue?.blcontinue ? { blcontinue: response.continue.blcontinue } : {};
    } while (continuation.blcontinue);

    return mergeUniqueTitles(pages);
};

const getBacklinkData = async (title: string): Promise<BacklinkResult> => {
    const normalizedTitle = normalizeTitle(title) ?? title;
    const aliases = mergeUniqueTitles(
        [normalizedTitle, ...(await getRedirectAliases(normalizedTitle))]
            .map(alias => normalizeTitle(alias) ?? alias),
    );
    const backlinks = await Promise.all(aliases.map(getBacklinks));
    return {
        aliases,
        pages: mergeUniqueTitles(backlinks.flat()),
    };
};

const savePage = async (title: string, content: string, data: PageData, summary: string) => {
    return api.postWithToken('csrf', {
        action: 'edit',
        basetimestamp: data.timestamp ?? undefined,
        errorformat: 'plaintext',
        formatversion: 2,
        minor: true,
        nocreate: true,
        starttimestamp: data.starttimestamp ?? undefined,
        summary,
        tags: 'Automation tool',
        text: content,
        title,
    });
};

export { getBacklinkData, getPage, savePage };
export type { BacklinkResult };
