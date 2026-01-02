import { consoleSuccess, consoleError } from "@/utils/statusConsole.js";

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
            consoleSuccess("移动");
        })
        .catch(error => {
            consoleError("DraftToMain", error);
        });
}
