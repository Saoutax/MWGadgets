import { DISAMBIGUATION_CATEGORY } from './config';

const { wgIsArticle, wgCategories = [], wgPageName = '', wgUserGroups } = mw.config.get();

/**
 * 检查当前页面是否为消歧义页
 */
const isDisam = () => wgCategories.includes(DISAMBIGUATION_CATEGORY);

/**
 * 检查当前页面是否符合加载条件
 */
const shouldLoad = () => wgIsArticle && isDisam(); // wgAction === 'view' 可以通过 Gadgets-definition 限制

/**
 * 检查当前页面是否带有消歧义页后缀
 */
const hasSuffix = () => wgPageName.endsWith('(消歧义页)');

/**
 * 检查当前用户是否为机器人或机器用户
 */
const hasBotRights = () => Boolean(wgUserGroups?.includes('bot') || wgUserGroups?.includes('flood'));

export { hasBotRights, hasSuffix, shouldLoad };
