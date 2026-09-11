import { config } from './config';
import type {
    BacklinkResult,
    MWBacklinkResponse,
    MWEditResponse,
    MWPageResponse,
    MWRedirectResponse,
    PageData,
} from './types';
import { mergeUniqueTitles, normalizeTitle } from './wiki';

/** MediaWiki API 客户端；在模块加载时创建，供本模块的所有请求复用。 */
const api = new mw.Api();

/**
 * 获取指定页面的正文和编辑时间戳。
 *
 * `session` 会用返回的正文建立页面工作副本，并在保存时使用两个时间戳检测编辑冲突。
 * 页面不存在、无效或 API 没有返回页面对象时返回 `null`，由调用方决定是否跳过该页面。
 *
 * @param title 要读取的页面标题
 * @returns 页面内容和时间戳；页面不存在或无效时返回 `null`
 */
const getPage = async (title: string): Promise<PageData | null> => {
    const {
        query: { pages: [page] },
    } = (await api.post({
        action: 'query',
        formatversion: 2,
        prop: 'revisions',
        rvprop: 'timestamp|content',
        curtimestamp: true,
        titles: title,
    })) as MWPageResponse;

    if ('missing' in page) {
        return null;
    }

    const {
        revisions: [{ content, timestamp }],
        starttimestamp,
    } = page;
    return { content, starttimestamp, timestamp };
};

/**
 * 获取指定页面的重定向标题。
 *
 * 该函数只由 `getBacklinkData` 使用，用于把可能指向重定向别名的链接也纳入扫描范围。
 * MediaWiki 会限制单次响应数量，所以必须把服务端返回的 continuation token 原样带回，
 * 不能用本地 offset 代替，否则结果较多时会漏掉后续别名。
 *
 * @param title 要查找重定向别名的目标标题
 * @returns 目标命名空间内所有重定向标题
 */
const getRedirectAliases = async (title: string): Promise<string[]> => {
    const aliases: string[] = [];
    let continuation: Record<string, string> = {};

    do {
        const {
            query: {
                pages: [{ redirects }],
            },
            continue: { rdcontinue } = {},
        } = (await api.post({
            action: 'query',
            formatversion: 2,
            prop: 'redirects',
            rdlimit: 'max',
            rdnamespace: config.targetNamespace,
            titles: title,
            ...continuation,
        })) as MWRedirectResponse;
        aliases.push(...(redirects ?? []).map(({ title }) => title));
        continuation = rdcontinue ? { rdcontinue } : {};
    } while (continuation.rdcontinue);

    return aliases;
};

/**
 * 获取引用指定标题的页面。
 *
 * `blredirect` 让 MediaWiki 同时考虑重定向关系；仍然需要由 `getBacklinkData` 分别查询
 * 原标题和重定向别名，因为页面正文可能直接写入任一标题。continuation token 必须逐页传回，
 * 才能覆盖超过单次 API 上限的完整结果。
 *
 * @param title 要查找链入页面的标题
 * @returns 引用该标题的页面标题，并按首次出现顺序去重
 */
const getBacklinks = async (title: string): Promise<string[]> => {
    const pages: string[] = [];
    let continuation: Record<string, string> = {};

    do {
        const {
            query: { backlinks },
            continue: { blcontinue } = {},
        } = (await api.post({
            action: 'query',
            bllimit: 'max',
            blnamespace: config.targetNamespace,
            blredirect: true,
            formatversion: 2,
            list: 'backlinks',
            ...continuation,
            bltitle: title,
        })) as MWBacklinkResponse;
        pages.push(...backlinks.map(({ title }) => title));
        continuation = blcontinue ? { blcontinue } : {};
    } while (continuation.blcontinue);

    return mergeUniqueTitles(pages);
};

/**
 * 收集一次消歧义会话需要处理的目标别名和链入页面。
 *
 * 先扩展重定向别名，再并发查询每个标题的链入页面，可以覆盖直接链接和经由别名的链接，
 * 同时缩短初始化等待时间。不同查询可能返回同一个页面，因此最终必须统一去重。
 *
 * @param title 用户选择的目标页面标题
 * @returns 规范化后的目标别名集合和待处理页面列表
 */
const getBacklinkData = async (title: string): Promise<BacklinkResult> => {
    const normalizedTitle = normalizeTitle(title) ?? title;
    const aliases = mergeUniqueTitles(
        [normalizedTitle, ...(await getRedirectAliases(normalizedTitle))].map(alias => normalizeTitle(alias) ?? alias),
    );
    const backlinks = await Promise.all(aliases.map(getBacklinks));
    return {
        aliases,
        pages: mergeUniqueTitles(backlinks.flat()),
    };
};

/**
 * 保存一个页面的修改。
 *
 * 使用 CSRF token 保护写操作，并携带读取页面时的时间戳，让 MediaWiki 在页面被他人修改时拒绝
 * 覆盖；`nocreate` 则避免把缺失页面意外创建出来。该函数由 `DisamSession.submit` 按变更页面调用。
 *
 * @param title 要保存的页面标题
 * @param content 页面修改后的完整维基文本
 * @param data 读取页面时保存的时间戳，作为并发编辑保护基线
 * @param summary 本次编辑摘要
 * @returns MediaWiki 编辑 API 的响应 Promise
 */
const savePage = async (title: string, content: string, data: PageData, summary: string): Promise<MWEditResponse> => {
    const response = (await api.postWithToken('csrf', {
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
    })) as unknown as MWEditResponse;
    return response;
};

export { getBacklinkData, getPage, savePage };
