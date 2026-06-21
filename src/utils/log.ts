/**
 * 提示错误
 *
 * @param gadget 小工具名称
 * @param error 错误信息
 */
const error = (gadget: string, error: never | unknown) => {
    mw.notify('发生错误，请于控制台查看详情。', { type: 'error' });
    console.log(`[${gadget}] Error: ${JSON.stringify(error)}`);
};

/**
 * 提示成功
 *
 * @param action 操作类型
 */
const info = (action: string) => {
    mw.notify(`${action}成功，即将刷新……`, { type: 'success' });
    setTimeout(() => {
        location.reload();
    }, 2000);
};

const log = { error, info };

export { log };
