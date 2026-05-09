/**
 * 提示错误
 *
 * @param gadget 小工具名称
 * @param error 错误信息
 */
const consoleError = (gadget: string, error: never | unknown) => {
    mw.notify('发生错误，请于控制台查看详情。', { type: 'error' });
    console.log(`[${gadget}] Error: ${JSON.stringify(error)}`);
};

/**
 * 提示成功
 *
 * @param action 操作类型
 */
const consoleSuccess = (action: string) => {
    mw.notify(`${action}成功，即将刷新……`, { type: 'success' });
    setTimeout(() => {
        location.reload();
    }, 2000);
};

export { consoleError, consoleSuccess };
