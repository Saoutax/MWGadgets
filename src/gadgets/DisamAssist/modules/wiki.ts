import type { ContextParts, TitleNormalizer, WikiLink } from './types';

const defaultTitleNormalizer: TitleNormalizer = title => {
    try {
        return new mw.Title(title).getPrefixedText();
    } catch {
        return null;
    }
};

const normalizeTitle = (title: string, normalizer: TitleNormalizer = defaultTitleNormalizer): string | null => {
    const withoutFragment = title.split('#', 1)[0]?.trim();
    if (!withoutFragment) {
        return null;
    }
    return normalizer(withoutFragment);
};

const getFragment = (title: string): string => {
    const index = title.indexOf('#');
    return index === -1 ? '' : title.slice(index);
};

const findWikiLink = (
    content: string,
    targets: ReadonlySet<string>,
    startIndex = 0,
    normalizer: TitleNormalizer = defaultTitleNormalizer,
): WikiLink | null => {
    const regex = /\[\[([^[\]]+?)(?:\|([^[\]]*?))?\]\]/g;
    regex.lastIndex = startIndex;

    let match: RegExpExecArray | null;
    while ((match = regex.exec(content)) !== null) {
        const title = match[1]?.trim() ?? '';
        const target = normalizeTitle(title, normalizer);
        if (!target || !targets.has(target)) {
            continue;
        }

        return {
            displayText: (match[2] || title).trim(),
            end: regex.lastIndex,
            start: match.index,
            target,
            title,
        };
    }

    return null;
};

const replaceWikiLink = (
    content: string,
    link: WikiLink,
    newTitle: string,
    normalizer: TitleNormalizer = defaultTitleNormalizer,
): string => {
    const target = `${newTitle}${getFragment(link.title)}`;
    const displayText = link.displayText || link.title;
    const normalizedTarget = normalizeTitle(target, normalizer);
    const normalizedDisplay = normalizeTitle(displayText, normalizer);
    const inner = normalizedTarget && normalizedTarget === normalizedDisplay ? target : `${target}|${displayText}`;
    return content.slice(0, link.start) + `[[${inner}]]` + content.slice(link.end);
};

const removeWikiLink = (content: string, link: WikiLink): string => {
    return content.slice(0, link.start) + link.displayText + content.slice(link.end);
};

const contextAround = (content: string, link: WikiLink, radius = 80): ContextParts => {
    const start = Math.max(0, link.start - radius);
    const end = Math.min(content.length, link.end + radius);
    const before = `${start > 0 ? '…' : ''}${content.slice(start, link.start)}`;
    const after = `${content.slice(link.end, end)}${end < content.length ? '…' : ''}`;
    return [before, content.slice(link.start, link.end), after];
};

const parseDisambiguationTargets = (
    content: string,
    normalizer: TitleNormalizer = defaultTitleNormalizer,
): string[] => {
    const result = new Set<string>();

    for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.split('——', 1)[0] ?? '';
        const linkMatches = line.matchAll(/\[\[([^[\]|#]+)(?:\|[^[\]]*)?\]\]/g);
        for (const match of linkMatches) {
            const target = normalizeTitle(match[1] ?? '', normalizer);
            if (target && !/^file:/i.test(target)) {
                result.add(target);
            }
        }

        const templateMatches = line.matchAll(/\{\{(?:dis|dl|coloredlink)\|([^|}\n]+)/gi);
        for (const match of templateMatches) {
            const target = normalizeTitle(match[1] ?? '', normalizer);
            if (target) {
                result.add(target);
            }
        }
    }

    return [...result];
};

const extractPageName = (
    link: HTMLAnchorElement,
    normalizer: TitleNormalizer = defaultTitleNormalizer,
): string | null => {
    const titleAttribute = link.getAttribute('title');
    if (titleAttribute) {
        return normalizeTitle(titleAttribute, normalizer);
    }

    try {
        const url = new URL(link.href, window.location.origin);
        if (url.origin !== window.location.origin || url.protocol !== window.location.protocol) {
            return null;
        }

        const pageTitle = decodeURIComponent(url.searchParams.get('title') || url.pathname.slice(1));
        return normalizeTitle(pageTitle, normalizer);
    } catch {
        return null;
    }
};

const mergeUniqueTitles = (titles: readonly string[]): string[] => [...new Set(titles)];

export {
    contextAround,
    extractPageName,
    findWikiLink,
    mergeUniqueTitles,
    normalizeTitle,
    parseDisambiguationTargets,
    removeWikiLink,
    replaceWikiLink,
};
