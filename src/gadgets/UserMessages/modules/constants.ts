/**
 * 模板配置页（站内 JSON，由界面管理员维护）。
 * 正式站为 MediaWiki:Gadget-UserMessages.json，测试期暂指向用户沙盒页。
 */
const CONFIG_PAGE = 'User:SaoMikoto/UserMessages.json';

/** localStorage 键名。 */
const STORAGE_KEY = 'usermessages-state';

/** 发送时附带的编辑标签（需在站上已定义）。 */
const EDIT_TAGS = 'Automation tool|UserMessages';

/** 对话框尺寸。 */
const DIALOG_SIZE: OO.ui.Window.Size = 'large';

/** 对话框内容区最大高度（px），超出则滚动。 */
const MAX_MAIN_BODY_HEIGHT = 520;

/** 预览对话框内容区最大高度（px）。 */
const MAX_PREVIEW_BODY_HEIGHT = 560;

/**
 * 需要的 ResourceLoader 模块。
 * oojs-ui 是元模块，其中 oojs-ui-windows 带的 themeStyles 是 WindowManager 定位与着色的来源；
 * mediawiki.widgets 提供 mw.widgets.TitleInputWidget。
 */
const RELOADER_MODULES = ['oojs-ui', 'mediawiki.widgets', 'mediawiki.api', 'mediawiki.util'];

/** 允许出现入口的命名空间：2 = User，3 = User talk，-1 = Special。 */
const ALLOWED_NAMESPACES = [2, 3, -1];

/** 允许出现入口的特殊页（仅当命名空间为 -1 时判断）。 */
const ALLOWED_SPECIAL_PAGES = ['Contributions', 'DeletedContributions', 'Block', 'Log'];

/** 尾随签名的默认值，可被 window.UserMessages.signatureSuffix 覆盖。 */
const DEFAULT_SIGNATURE_SUFFIX = ' ——~~~~';

/**
 * 目标用户的讨论页标题。
 * 预览（parse 的 title）与实际发送（edit 的 title）必须指向同一个页面，故此处在两边共用。
 * @param user 用户名，不含命名空间前缀
 */
const talkPageTitle = (user: string): string => `User talk:${user}`;

export {
    ALLOWED_NAMESPACES,
    ALLOWED_SPECIAL_PAGES,
    CONFIG_PAGE,
    DEFAULT_SIGNATURE_SUFFIX,
    DIALOG_SIZE,
    EDIT_TAGS,
    MAX_MAIN_BODY_HEIGHT,
    MAX_PREVIEW_BODY_HEIGHT,
    RELOADER_MODULES,
    STORAGE_KEY,
    talkPageTitle,
};
