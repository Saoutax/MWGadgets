export default async function move(from: string, to: string) {
    new mw.Api()
        .postWithToken("csrf", {
            action: "move",
            from,
            to,
            reason: "编写完成",
            movetalk: "noleave",
            noredirect: true,
            tags: "Automation tool",
        })
        .then(() => {
            mw.notify("移动成功，即将跳转……", { type: "success" });
            setTimeout(() => {
                window.location.href = mw.util.getUrl(to);
            }, 2000);
        })
        .catch(error => {
            mw.notify("移动时出现错误，请于控制台查看详情。", { type: "error" });
            console.log(`[DraftToMain] 移动时发生错误：${error}`);
        });
}
