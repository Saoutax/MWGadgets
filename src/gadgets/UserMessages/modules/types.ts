/** 参数控件类型。page 用带联想的标题输入框，multiline 用多行文本框，其余为单行文本框。 */
type ParamType = 'page' | 'text' | 'multiline';

/** 模板参数定义（对应配置 JSON 里的 parameters 数组项）。 */
interface TemplateParam {
    /** 模板参数名，如 "1" */
    key: string;
    /** 界面上显示的字段名 */
    label: string;
    /** 控件类型，缺省为 text */
    type?: ParamType;
    /** 是否必填，缺省为 false */
    required?: boolean;
    /** 初始值，缺省为空 */
    default?: string;
}

/** 单个模板定义。 */
interface TemplateEntry {
    /** 下拉里显示的模板名 */
    title: string;
    /** 模板页名，如 Template:UserMessages/Welcome */
    template: string;
    /** 选中该模板时自动填入的编辑摘要 */
    summary: string;
    /** 参数定义，可为空 */
    parameters?: TemplateParam[];
}

/** 站内配置页的结构。 */
interface UserMessagesConfig {
    templates: TemplateEntry[];
}

/**
 * 配置预取结果。
 * 预取永不 reject —— 失败同样是一种结果，以便入口做同步判断。
 */
type ConfigResult = { ok: true; config: UserMessagesConfig } | { ok: false; message: string };

/**
 * 主对话框的打开数据。
 * 必须是 type 别名而非 interface：TS 只给对象字面量类型别名隐式索引签名，
 * 而 OO.ui.Dialog.getSetupProcess 的参数类型是 SetupDataMap & Record<string, any>。
 */
type MainDialogData = {
    /** 目标用户（取自 wgRelevantUserName，只读） */
    targetUser: string;
    /** 模板配置的预取 promise */
    configPromise: Promise<ConfigResult>;
    /** 请求打开预览对话框；主对话框保持开启，预览叠加其上 */
    onPreview: (data: PreviewDialogData) => void;
};

/** 预览对话框的打开数据。 */
type PreviewDialogData = {
    /** 对话框标题。OO.ui.Dialog 会读取打开数据里的 title 覆写静态标题。 */
    title: string;
    /** 目标用户 */
    targetUser: string;
    /** action=parse 渲染出的 HTML */
    previewHtml: string;
    /** 最终提交正文，已含 subst 改写与签名 */
    submittedText: string;
    /** 编辑摘要 */
    editSummary: string;
};

/** 主对话框在渲染预览之前能产出的部分。 */
type PreviewSubmission = Omit<PreviewDialogData, 'title' | 'previewHtml'> & { templateTitle: string };

/** 主对话框的关闭结果。 */
type MainDialogResult = { action: 'cancel' } | { action: 'configError'; message: string } | undefined;

/** 发送结果。失败不抛错，以便「重试」。 */
type SendResult = { ok: true } | { ok: false; code: string; detail: string };

export type {
    ConfigResult,
    MainDialogData,
    MainDialogResult,
    ParamType,
    PreviewDialogData,
    PreviewSubmission,
    SendResult,
    TemplateEntry,
    TemplateParam,
    UserMessagesConfig,
};
