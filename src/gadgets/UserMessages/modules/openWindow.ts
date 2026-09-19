/** 窗口关闭时携带的结果。 */
interface WindowCloseResult {
    action?: string;
}

/**
 * 把对话框挂到独立的 WindowManager 上并打开，关闭后自动清理并回调。
 *
 * 每个对话框都挂到 document.body 是嵌套弹窗（预览框之上再弹错误框）能正常工作的前提：
 * WindowManager 的 toggleIsolation 会跳过已被其它 manager 标记 aria-hidden / inert 的兄弟节点，
 * 因此多个 manager 可以叠加，而不会互相解除隔离。
 *
 * @param dialog 对话框实例
 * @param data 打开数据，在 getSetupProcess 中读取
 * @param onClosed 关闭后的回调，携带 close() 传入的数据
 */
const openWindow = <D extends object, R = WindowCloseResult>(
    dialog: OO.ui.Dialog,
    data: D,
    onClosed?: (result: R | undefined) => void,
): void => {
    const manager = new OO.ui.WindowManager();
    $(document.body).append(manager.$element);
    manager.addWindows([dialog]);

    const instance = manager.openWindow(dialog, data as unknown as OO.ui.WindowManager.WindowOpeningData);
    // WindowInstance.closed 在 @types/oojs-ui 中被标注为 Promise<void>，运行时携带 close() 传入的数据
    const closed = instance.closed as unknown as JQuery.Promise<R | undefined>;
    void closed.then(result => {
        manager.$element.remove();
        manager.destroy();
        onClosed?.(result);
    });
};

export { type WindowCloseResult, openWindow };
