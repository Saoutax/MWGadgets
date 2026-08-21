/** 窗口关闭时携带的结果 */
export interface WindowResult<T> {
    action: string;
    data: T;
}

/**
 * 弹出简单消息提示框。
 * @param title 标题
 * @param message 消息内容
 */
export function simpleAlert(title: string, message: string): void {
    const messageDialog = new OO.ui.MessageDialog();
    openWindow(messageDialog, {
        title,
        message,
        actions: [{ action: 'ok', label: '确定', flags: ['primary', 'safe'] }],
    });
}

/**
 * 将对话框挂载到独立的 WindowManager 并打开；关闭后自动清理并回调。
 * @param dialog 对话框实例
 * @param data 打开数据
 * @param closureCallback 关闭后的回调（携带关闭结果）
 */
export function openWindow<T>(
    dialog: OO.ui.Dialog,
    data?: OO.ui.WindowManager.WindowOpeningData,
    closureCallback: (data: T) => void = () => {},
): void {
    const windowManager = new OO.ui.WindowManager({ classes: ['masstoolkit-window'] });
    $(document.body).append(windowManager.$element);
    windowManager.addWindows([dialog]);

    const opened = windowManager.openWindow(dialog, data);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    opened.closed.then((result: any) => {
        windowManager.$element.remove();
        windowManager.destroy();
        closureCallback(result as T);
    });
}
