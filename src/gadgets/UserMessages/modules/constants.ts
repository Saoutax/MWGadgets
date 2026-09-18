/** 模板配置页（站内 JSON，由界面管理员维护）。 */
export const CONFIG_PAGE = 'MediaWiki:Gadget-UserMessages.json';

/** localStorage 键名。 */
export const STORAGE_KEY = 'usermessages-state';

/** 发送时附带的编辑标签（需在站上已定义）。 */
export const EDIT_TAGS = 'Automation tool|UserMessages';

/** 对话框尺寸。 */
export const DIALOG_SIZE: OO.ui.Window.Size = 'large';

/** 对话框内容区最大高度（px），超出则滚动。 */
export const MAX_MAIN_BODY_HEIGHT = 520;

/** 预览对话框内容区最大高度（px）。 */
export const MAX_PREVIEW_BODY_HEIGHT = 560;

/**
 * 需要的 ResourceLoader 模块。
 * oojs-ui 是元模块，其中 oojs-ui-windows 带的 themeStyles 是 WindowManager 定位与着色的来源；
 * mediawiki.widgets 提供 mw.widgets.TitleInputWidget。
 */
export const RELOADER_MODULES = ['oojs-ui', 'mediawiki.widgets', 'mediawiki.api', 'mediawiki.util'];

/** 允许出现入口的命名空间：2 = User，3 = User talk，-1 = Special。 */
export const ALLOWED_NAMESPACES = [2, 3, -1];

/** 允许出现入口的特殊页（仅当命名空间为 -1 时判断）。 */
export const ALLOWED_SPECIAL_PAGES = ['Contributions', 'DeletedContributions', 'Block', 'Log'];

/** 签名后缀，固定不可配置。 */
export const SIGNATURE_SUFFIX = ' ——~~~~';
