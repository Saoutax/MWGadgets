import { openWindow } from './openWindow';

/** 消息对话框的内容。 */
interface MessageSpec {
    title: string;
    /** 纯文本或 jQuery 节点 */
    message: string | JQuery;
}

/**
 * 打开一个消息对话框并等待关闭。
 * @param spec 标题与正文
 * @param actions 底部按钮配置
 * @returns 关闭时按下的动作名；按 Esc 关闭（无数据）统一归一化为 'close'
 */
const showMessage = (spec: MessageSpec, actions: OO.ui.ActionWidget.ConfigOptions[]): Promise<string> => {
    return new Promise(resolve => {
        const data = { title: spec.title, message: spec.message, actions };
        openWindow<typeof data, { action?: string }>(new OO.ui.MessageDialog(), data, result => {
            resolve(result?.action ?? 'close');
        });
    });
};

/**
 * 只带「关闭」按钮的错误提示，不等待用户操作。
 * @param title 标题
 * @param message 正文
 */
const showError = (title: string, message: string): void => {
    void showMessage({ title, message }, [{ action: 'close', label: '关闭', flags: ['safe'] }]);
};

/**
 * 发送失败时的「关闭 / 重试」对话框。
 * @param title 标题
 * @param message 正文
 */
const confirmRetry = async (title: string, message: string): Promise<'retry' | 'close'> => {
    const action = await showMessage({ title, message }, [
        { action: 'close', label: '关闭', flags: ['safe'] },
        { action: 'retry', label: '重试', flags: ['primary', 'progressive'] },
    ]);
    return action === 'retry' ? 'retry' : 'close';
};

export { type MessageSpec, confirmRetry, showError, showMessage };
