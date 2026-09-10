/** DisamAssist 运行时使用的页面类别和标题后缀。 */
const DISAMBIGUATION_CATEGORY = '消歧义页';
const DISAMBIGUATION_SUFFIX = '(消歧义页)';

/**
 * DisamAssist 的交互参数。
 *
 * `autoSubmitDelay` 使用毫秒，`contextRadius` 使用字符串字符数，`targetNamespace` 使用 MediaWiki
 * 命名空间编号；这些配置集中管理，保证 API 查询、面板展示和会话计时使用相同的约定。
 */
const config = {
    autoSubmitDelay: 30_000,
    contextRadius: 80,
    maxUndoEntries: 500,
    targetNamespace: 0,
};

export { config, DISAMBIGUATION_CATEGORY, DISAMBIGUATION_SUFFIX };
