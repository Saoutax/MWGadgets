import { DISAMBIGUATION_CATEGORY } from './config';

// 这些值在模块加载时读取一次，代表本次页面加载对应的 MediaWiki 环境快照。
const { wgIsArticle, wgCategories = [], wgPageName = '', wgUserGroups } = mw.config.get();

/**
 * 判断当前页面是否属于消歧义页分类。
 *
 * @returns 当前页面是否包含消歧义页分类
 */
const isDisam = (): boolean => wgCategories.includes(DISAMBIGUATION_CATEGORY);

/**
 * 判断 DisamAssist 是否应在当前页面加载。
 *
 * 入口使用此守卫避免在非文章页或普通条目页注入面板和发起 API 请求；`wgAction === 'view'`
 * 则由 Gadget 定义负责限制。
 *
 * @returns 当前页面是消歧义文章页时返回 `true`
 */
const shouldLoad = (): boolean => wgIsArticle && isDisam();

/**
 * 判断当前消歧义页标题是否带有约定后缀。
 *
 * `start` 会根据该结果决定是否同时提供“主条目”和“当前消歧义页”两种入口。
 *
 * @returns 页面标题是否以 `(消歧义页)` 结尾
 */
const hasSuffix = (): boolean => wgPageName.endsWith('(消歧义页)');

/**
 * 判断当前用户是否具有机器人或 flood 权限。
 *
 * 该检查为后续按用户权限调整功能保留，目前不参与入口加载判断。
 *
 * @returns 用户属于 `bot` 或 `flood` 用户组时返回 `true`
 */
const hasBotRights = (): boolean => Boolean(wgUserGroups?.includes('bot') || wgUserGroups?.includes('flood'));

export { hasBotRights, hasSuffix, shouldLoad };
