const { wgPageName } = mw.config.get();
export default async function edit(text: string) {
    new mw.Api()
        .postWithToken("csrf", {
            action: "edit",
            title: wgPageName,
            text,
            summary: "[[User:SaoMikoto/js#快速移除预加载模板|移除预加载模板]]",
            tags: "Automation tool",
        })
        .then(() => {
            mw.notify("清理完成，即将刷新……", { type: "success" });
            setTimeout(() => {
                location.reload();
            }, 2000);
        })
        .catch(error => {
            mw.notify("清理失败，请于控制台查看详情。", { type: "error" });
            console.log(`[CleanPreload] 清理时发生错误：${error}`);
        });
}
