import { consoleSuccess, consoleError } from "@/utils/statusConsole.js";

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
            consoleSuccess("清理");
        })
        .catch(error => {
            consoleError("CleanPreload", error);
        });
}
