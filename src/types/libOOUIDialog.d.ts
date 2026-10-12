/**
 * `ext.gadget.libOOUIDialog` 提供的对话框封装。
 *
 * 运行时是 `async` 包装的 `OO.ui.MessageDialog`，因此返回原生 `Promise` 而非 `JQuery.Promise`；
 * `confirm` 在用户取消或直接关闭时给出 `null`。字符串消息按 HTML 解析，插入外部文本前应先用
 * `oouiDialog.sanitize()` 转义。
 */
interface OouiDialogOptions {
    /** 对话框标题，默认「萌娘百科提醒您」 */
    title?: string;
    /** OOUI 窗口尺寸 */
    size?: string;
    /** 是否允许全屏 */
    allowFullscreen?: boolean;
}

declare const oouiDialog: {
    /**
     * 弹出确认框。
     *
     * @param message 消息内容，字符串按 HTML 解析
     * @param options 对话框选项
     * @returns 用户是否确认
     */
    confirm(message: string | JQuery, options?: OouiDialogOptions): Promise<boolean | null>;

    /**
     * 弹出提示框。
     *
     * @param message 消息内容，字符串按 HTML 解析
     * @param options 对话框选项
     */
    alert(message: string | JQuery, options?: OouiDialogOptions): Promise<void>;

    /**
     * 转义文本，使其可安全插入按 HTML 解析的对话框消息。
     *
     * @param text 原始文本
     * @returns 转义后的文本
     */
    sanitize(text: string): string;
};
