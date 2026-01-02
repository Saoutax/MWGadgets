export function consoleError(gadget: string, error: never | unknown): void {
    mw.notify("发生错误，请于控制台查看详情。", { type: "error" });
    console.log(`[${gadget}] Error: ${JSON.stringify(error)}`);
}

export function consoleSuccess(action: string): void {
    mw.notify(`${action}成功，即将刷新……`, { type: "success" });
    setTimeout(() => {
        location.reload();
    }, 2000);
}
