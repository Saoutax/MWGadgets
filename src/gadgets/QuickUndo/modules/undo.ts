import { consoleSuccess, consoleError } from "@/utils/statusConsole.js";

export async function undo(pageid: number, undoid: number, undoafter: number, ignoreabusefilter: boolean = true) {
    await new mw.Api()
        .postWithToken("csrf", {
            action: "edit",
            pageid,
            undo: undoid,
            undoafter,
            summary: "// QuickUndo",
            tags: "Automation tool",
            format: "json",
        })
        .then(data => {
            if (data.edit && data.edit.result == "Success") {
                if (data.edit.nochange !== undefined) {
                    mw.notify("这次编辑似乎已被撤销。");
                } else {
                    consoleSuccess("撤销");
                }
            } else if (data.edit && data.edit.result == "Failure" && data.edit.abusefilter && data.edit.abusefilter.actions.indexOf("warn") != -1 && ignoreabusefilter) {
                mw.notify(`遇到${data.edit.abusefilter.id}号过滤器：${data.edit.abusefilter.description}，警告已忽略`);
                setTimeout(() => {
                    undo(pageid, undoid, undoafter, false);
                }, 0);
            } else if (data.edit && data.edit.result === "Failure") {
                if (data.error?.info === "The edit could not be undone due to conflicting intermediate edits.") {
                    mw.notify("因存在冲突的中间编辑，本编辑不能撤销。", { type: "error" });
                } else {
                    mw.notify("撤销失败: " + (data.edit.info || JSON.stringify(data)), { type: "error" });
                }
            }
        })
        .catch(err => {
            consoleError("QuickUndo", err);
        });
}
