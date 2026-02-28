(async () => {
    const { wgPageName, wgNamespaceNumber, wgUserGroups } = mw.config.get();
    const api = new mw.Api();

    if (wgNamespaceNumber !== 0 || !wgUserGroups || (!wgUserGroups.includes("moderator") && !wgUserGroups.includes("sysop")) || wgPageName === "Home") {
        return;
    }

    const reviewPageName = `Status:${wgPageName}`;

    function createButton(html: string, action: () => void) {
        const div = document.createElement("div");
        div.classList.add("citizen-header__item");

        const button = document.createElement("button");
        button.classList.add("citizen-header__button", "citizen-button");
        button.innerHTML = html;
        button.onclick = action;

        div.appendChild(button);
        return div;
    }

    function updateReviewPage(status: string) {
        const text = `{{${status}|~~~~}}`;

        api.postWithToken("csrf", {
            action: "edit",
            title: reviewPageName,
            text,
            tags: "Automation tool",
            summary: `审核状态：${status}`,
        })
            .done(() => {
                mw.notify(`审核状态已更新：${status}`);
            })
            .fail(() => {
                mw.notify("更新失败", { type: "error" });
            });
    }

    function buttonText(type: string, content: string) {
        const regex = new RegExp(`${type}`, "gui");
        const result = regex.test(content);
        const text = result ? `<b>${type}</b>` : type;

        return text;
    }

    const data = await api.post({
        action: "query",
        titles: reviewPageName,
        prop: "revisions",
        rvprop: "content",
        formatversion: 2,
    });

    const content = data.query.pages?.[0]?.revisions?.[0]?.content || "";

    const passText = content ? buttonText("Pass", content) : "Pass";
    const failText = content ? buttonText("Fail", content) : "Fail";

    const passButton = createButton(passText, async () => {
        updateReviewPage("Pass");
        const {
            query: {
                pages: [{ lastrevid }],
            },
        } = await api.post({
            action: "query",
            format: "json",
            prop: "info",
            titles: wgPageName,
            formatversion: "2",
        });
        await api.postWithToken("csrf", {
            action: "approve",
            revid: lastrevid,
        });
    });

    const failButton = createButton(failText, () => {
        updateReviewPage("Fail");
    });

    const header = document.querySelector(".citizen-header__end");
    if (header) {
        header.appendChild(passButton);
        header.appendChild(failButton);
    }
})();
