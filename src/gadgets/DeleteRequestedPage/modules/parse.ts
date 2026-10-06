import type { RequestInfo, RequestKey } from './types';

/**
 * 已知标签 → 结果字段名。
 */
const LABEL_TO_KEY: Record<string, RequestKey> = {
    页面标题: 'title',
    申请理由: 'reason',
    详细原因: 'detail',
};

/**
 * 归一化 `<b>` 标签文本，去掉冒号与空白。
 *
 * 源码既可能写成 `'''页面标题'''：`，也可能写成 `'''申请理由：'''`（冒号被一并加粗），
 * 归一化后两者都得到 `申请理由`。
 *
 * @param label 原始标签文本
 * @returns 归一化后的标签
 */
const normalizeLabel = (label: string): string => label.replace(/[:：\s]/gu, '');

/**
 * 归一化标签值，去掉前导冒号与空白并折叠内部空白。
 *
 * @param value 原始值文本
 * @returns 归一化后的值
 */
const normalizeValue = (value: string): string =>
    value
        .replace(/^[\s:：]+/u, '')
        .replace(/\s+/gu, ' ')
        .trim();

/**
 * 读出 `<li>` 对应的结果字段名；不是已知的「标签：值」行时返回 null。
 *
 * @param li 列表项
 * @returns 字段名，无法识别时为 null
 */
const getKey = (li: Element): RequestKey | null => {
    const $bold = $(li).children('b').first();
    if (!$bold.length) {
        return null;
    }
    const key = LABEL_TO_KEY[normalizeLabel($bold.text())];
    return typeof key === 'string' ? key : null;
};

/**
 * 读出 `<li>` 的标签值，即移除首个 `<b>` 之后的全部文本。
 *
 * 只取文本、不退回锚点的 `title` 属性：红链的 `title` 带「（页面不存在）」后缀，
 * 会污染页面标题；而 `{{NoRedirectLink}}` 渲染出的外链本就有文本、也没有 `title`。
 *
 * @param li 列表项
 * @returns 归一化后的值
 */
const getValue = (li: Element): string => {
    const $rest = $(li).clone();
    $rest.children('b').first().remove();
    return normalizeValue($rest.text());
};

/**
 * 在容器内找到申请表格，取文档顺序第一个。
 *
 * @param $root 根容器
 * @returns 匹配的 `<ul>`；找不到时为空集
 */
const findRequestList = ($root: JQuery): JQuery =>
    $root
        .find('ul')
        .add($root.filter('ul'))
        .filter(
            (_, ul) =>
                $(ul)
                    .children('li')
                    .filter((_, li) => getKey(li) !== null).length > 0,
        )
        .first();

/**
 * 解析单个申请表格。
 *
 * @param ul 申请表格 `<ul>`
 * @param sectionTitle 所属讨论串锚点 id
 * @param header 所属讨论串标题元素
 * @returns 未命中「页面标题」或「申请理由」时返回 null
 */
const parseList = (ul: Element, sectionTitle: string | undefined, header: Element): RequestInfo | null => {
    const info: RequestInfo = { sectionTitle, header };
    for (const li of $(ul).children('li').toArray()) {
        const key = getKey(li);
        if (key !== null) {
            info[key] = getValue(li);
        }
    }
    if (info.title === undefined && info.reason === undefined) {
        return null;
    }
    return info;
};

/**
 * 遍历全页讨论串，解析其中的申请表格。
 *
 * @param filterClassess 与 `getDiscussionHeader` 同义：正文含这些 class 的段落会被跳过
 * @returns 只包含成功解析出的讨论串，按文档顺序
 */
const parseAll = (filterClassess: string[]): RequestInfo[] =>
    window.libDiscussionUtil
        .getDiscussionHeader(filterClassess)
        .map(({ self, sectionTitle }) => {
            const $list = findRequestList(self.nextUntil('h2, .mw-heading2').not('h2, .mw-heading2'));
            return $list.length ? parseList($list[0]!, sectionTitle, self[0]!) : null;
        })
        .filter(info => info !== null);

export { parseAll };
