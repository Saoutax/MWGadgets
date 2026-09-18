/** 全 gadget 共享的 mw.Api 实例。 */
const api = new mw.Api();

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
const fetchPageContent = async (title: string): Promise<string> => {
    const res = (await api.get({
        action: 'query',
        titles: title,
        prop: 'revisions',
        rvprop: 'content',
        formatversion: 2,
    })) as QueryRevisionsResponse;
    return res.query?.pages?.[0]?.revisions?.[0]?.content ?? '';
};

/**
 * 读取页面的 wikitext，页面不存在或内容为空时抛错。
 * 自定义模式用它，避免把空页面静默地变成一个空编辑器。
 * @param title 页面名
 */
const fetchPageContentOrThrow = async (title: string): Promise<string> => {
    const content = await fetchPageContent(title);
    if (content.trim() === '') {
        throw new Error(`页面 ${title} 不存在或内容为空`);
    }
    return content;
};

/**
 * 用 action=parse 渲染 wikitext 为 HTML（预览用）。
 *
 * 正文常带 {{subst:}} 与签名（~~~~）。MediaWiki 没有任何单一 parse flag 能同时
 * 「做 PST 替换 + 完整解析」：onlypst 只展开 subst/签名却不解析链接与解析函数（表现为部分渲染），
 * 普通 parse（含 preview）会解析但不展开 subst/签名。真实页面是「存盘时 PST、浏览时再解析」，
 * 故此处两步复刻：先 onlypst 得到替换后的 wikitext，再对它做完整解析，得到最终 HTML。
 * 注意：formatversion=2 下 parse.text 是纯字符串，不是 { '*': ... }。
 * @param wikitext 待渲染的 wikitext
 */
const parseWikitext = async (wikitext: string): Promise<string> => {
    // 第一步：仅做 PST 替换，展开 {{subst:}} 与签名，输出替换后的 wikitext
    const pstRes = (await api.post({
        action: 'parse',
        text: wikitext,
        contentmodel: 'wikitext',
        onlypst: true,
        formatversion: 2,
    })) as ParseResponse;
    const transformed = String(pstRes.parse?.text ?? '');

    // 第二步：对替换后的 wikitext 做完整解析，渲染链接、解析函数与内联模板
    const res = (await api.post({
        action: 'parse',
        text: transformed,
        contentmodel: 'wikitext',
        disablelimitreport: true,
        formatversion: 2,
        wrapoutputclass: 'mw-parser-output',
    })) as ParseResponse;
    return String(res.parse?.text ?? '');
};

export { api, fetchPageContent, fetchPageContentOrThrow, parseWikitext };
