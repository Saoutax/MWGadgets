/** 全 gadget 共享的 mw.Api 实例。 */
export const api = new mw.Api();

/** query&prop=revisions 响应中我们关心的部分。 */
interface QueryRevisionsResponse {
    query?: {
        pages?: {
            missing?: boolean;
            revisions?: { content?: string }[];
        }[];
    };
}

/** action=parse 响应中我们关心的部分。 */
interface ParseResponse {
    parse?: { text?: string };
}

/**
 * 读取页面的 wikitext。
 * @param title 页面名
 * @returns 页面内容；页面不存在时为空字符串
 */
export async function fetchPageContent(title: string): Promise<string> {
    const res = (await api.get({
        action: 'query',
        titles: title,
        prop: 'revisions',
        rvprop: 'content',
        formatversion: 2,
    })) as QueryRevisionsResponse;
    return res.query?.pages?.[0]?.revisions?.[0]?.content ?? '';
}

/**
 * 读取页面的 wikitext，页面不存在或内容为空时抛错。
 * 自定义模式用它，避免把空页面静默地变成一个空编辑器。
 * @param title 页面名
 */
export async function fetchPageContentOrThrow(title: string): Promise<string> {
    const content = await fetchPageContent(title);
    if (content.trim() === '') {
        throw new Error(`页面 ${title} 不存在或内容为空`);
    }
    return content;
}

/**
 * 用 action=parse 渲染 wikitext 为 HTML（预览用）。
 * 注意：formatversion=2 下 parse.text 是纯字符串，不是 { '*': ... }。
 * @param wikitext 待渲染的 wikitext
 */
export async function parseWikitext(wikitext: string): Promise<string> {
    const res = (await api.post({
        action: 'parse',
        text: wikitext,
        contentmodel: 'wikitext',
        formatversion: 2,
        wrapoutputclass: 'mw-parser-output',
    })) as ParseResponse;
    return String(res.parse?.text ?? '');
}
