import type { ContextParts, TitleNormalizer, WikiLink } from './types';

/**
 * 使用 MediaWiki 标题解析器规范化标题。
 *
 * 非法标题不会中断整页扫描，而是转换为 `null` 交给调用方跳过；测试或特殊调用场景可以注入
 * 自定义规范化器，避免依赖浏览器中的 `mw.Title`。
 */
const defaultTitleNormalizer: TitleNormalizer = title => {
    try {
        return new mw.Title(title).getPrefixedText();
    } catch {
        return null;
    }
};

/**
 * 将标题转换为用于比较的规范标题。
 *
 * fragment 表示页面内章节，不属于页面目标本身，因此匹配前先移除；替换链接时会由
 * `getFragment` 单独取回并保留。
 *
 * @param title 原始链接标题，可能包含 fragment
 * @param normalizer 标题规范化函数，默认使用 MediaWiki `Title`
 * @returns 规范化后的页面标题；空标题或非法标题返回 `null`
 */
const normalizeTitle = (title: string, normalizer: TitleNormalizer = defaultTitleNormalizer): string | null => {
    const withoutFragment = title.split('#', 1)[0]?.trim();
    if (!withoutFragment) {
        return null;
    }
    return normalizer(withoutFragment);
};

/**
 * 提取链接标题中的章节 fragment。
 *
 * @param title 原始链接标题
 * @returns 包含 `#` 的 fragment；标题没有章节时返回空字符串
 */
const getFragment = (title: string): string => {
    const index = title.indexOf('#');
    return index === -1 ? '' : title.slice(index);
};

/**
 * 从正文中查找下一个指向候选目标的维基链接。
 *
 * 这是面向常见 `[[目标]]` / `[[目标|显示文字]]` 形式的轻量扫描器，不试图完整解析所有
 * wikitext。`session` 会在修改后传入新的起点，因为旧链接的字符偏移只对修改前的正文有效。
 *
 * @param content 待扫描的页面正文
 * @param targets 允许匹配的规范化目标标题集合
 * @param startIndex 开始扫描的字符位置，用于继续处理当前页面
 * @param normalizer 将原始标题转换为可比较标题的函数
 * @returns 首个匹配链接的位置信息；找不到时返回 `null`
 */
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

/**
 * 将链接指向新的页面，同时保留原有章节和必要的显示文字。
 *
 * 当规范化后的新目标与显示文字相同时省略 pipe，避免生成冗余链接；否则保留显示文字，
 * 以免替换目标意外改变读者看到的文本。
 *
 * @param content 页面当前正文
 * @param link 待替换链接在当前正文中的位置信息
 * @param newTitle 新的页面标题
 * @param normalizer 用于判断目标和显示文字是否等价的规范化函数
 * @returns 替换后的正文
 */
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

/**
 * 移除 wikilink 标记并保留链接的显示文字。
 *
 * 该操作用于用户选择“移除链接”时保留原文可见内容，而不是删除整段文字。
 *
 * @param content 页面当前正文
 * @param link 待移除链接在当前正文中的位置信息
 * @returns 移除链接标记后的正文
 */
const removeWikiLink = (content: string, link: WikiLink): string => {
    return content.slice(0, link.start) + link.displayText + content.slice(link.end);
};

/**
 * 取得链接前后的有限上下文，供面板展示当前处理位置。
 *
 * @param content 页面正文
 * @param link 要突出显示的链接
 * @param radius 链接两侧最多展示的字符数
 * @returns `[前文, 链接原文, 后文]` 三元组；被截断的一侧带省略号
 */
const contextAround = (content: string, link: WikiLink, radius = 80): ContextParts => {
    const start = Math.max(0, link.start - radius);
    const end = Math.min(content.length, link.end + radius);
    const before = `${start > 0 ? '…' : ''}${content.slice(start, link.start)}`;
    const after = `${content.slice(link.end, end)}${end < content.length ? '…' : ''}`;
    return [before, content.slice(link.start, link.end), after];
};

/**
 * 从消歧义页正文中提取候选目标标题。
 *
 * 解析支持普通 wikilink 以及常见消歧义模板的首个参数。每行先截断 `——` 后的说明，
 * 避免把解释文字当作条目；`File:` 链接会被排除，因为文件不是可替换的条目候选。
 *
 * @param content 消歧义页正文
 * @param normalizer 标题规范化函数
 * @returns 按首次出现顺序去重后的候选标题
 */
const parseDisambiguationTargets = (
    content: string,
    normalizer: TitleNormalizer = defaultTitleNormalizer,
): string[] => {
    const result = new Set<string>();

    for (const rawLine of content.split(/\r?\n/)) {
        // 消歧义页常用“链接——说明”格式，说明部分不是目标标题。
        const line = rawLine.split('——', 1)[0] ?? '';
        const linkMatches = line.matchAll(/\[\[([^[\]|#]+)(?:\|[^\[\]]*)?\]\]/g);
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

/**
 * 从页面中的 HTML 链接解析规范化页面标题。
 *
 * 优先使用 `title` 属性；没有该属性时才解析 URL。URL 必须与当前页面同源且使用同协议，
 * 防止候选标记误作用于外部链接；解码或解析失败时返回 `null`。
 *
 * @param link 要解析的 HTML 锚元素
 * @param normalizer 标题规范化函数
 * @returns 页面规范标题；无法安全解析时返回 `null`
 */
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

/**
 * 去除标题列表中的重复项，同时保留首次出现顺序。
 *
 * @param titles 待去重的标题列表
 * @returns 去重后的标题列表
 */
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
