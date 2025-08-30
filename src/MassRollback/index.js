/* TODO:
    1.回退/撤销失败的页面给出控制台以外的提示
    2.为管理员回退提供markbot可选框，无需以flood用户组或URL带bot视为开关
    3.可能不需要连选功能，按住shift可自动连选，但移动设备无shift
    4.使用ooui
*/
"use strict";
$.when($.ready, mw.loader.using(["mediawiki.api", "ext.gadget.libOOUIDialog"])).then(() => {
    if (mw.config.get("wgCanonicalSpecialPageName") !== "Contributions") {
        return;
    }

    $(".mw-contributions-list li").each(function () {
        const newChk = document.createElement("input");
        newChk.setAttribute("type", "checkbox");
        newChk.setAttribute("data-title", this.getElementsByClassName("mw-contributions-title")[0].innerText);
        newChk.setAttribute("data-revid", this.getAttribute("data-mw-revid"));
        this.prepend(newChk);
    });

    const $actionsDiv = $('<div>', { id: 'mw-history-revision-actions' }).css({ float: 'right', 'margin-bottom': '1em' });

    const buttonsConfig = [
        { label: '全选/反选', id: 'mw-checkbox-invert' },
        { label: '连选', id: 'mw-checkbox-between', title: '请勾选需要操作的第一个和最后一个复选框后点击此按钮。' },
        { label: '撤销', id: 'contributions-undo-button', classes: ['mw-ui-progressive'] },
        { label: '回退', id: 'contributions-rollback-button', classes: ['mw-ui-progressive', 'patroller-show'], title: '默认不启用markbotedit权限。' },
        { label: '挂删', id: 'contributions-registerdelete-button', classes: ['mw-ui-progressive', 'patroller-show'] },
        { label: '版本删除', id: 'contributions-revdel-button', classes: ['mw-ui-progressive', 'sysop-show'], title: '默认仅删除内容和摘要。' }
    ];
    $actionsDiv.append(
        ...buttonsConfig.map(cfg => new OO.ui.ButtonWidget(cfg).$element)
    );

    $('div.mw-htmlform-ooui-wrapper.oo-ui-layout.oo-ui-panelLayout.oo-ui-panelLayout-padded.oo-ui-panelLayout-framed').after($actionsDiv);

    $("#mw-checkbox-invert").click(() => {
        $("li input[type=\"checkbox\"]").prop("checked", (_i, ele) => !ele);
    });
    $("#mw-checkbox-between").click(() => {
        const last = $(".mw-contributions-list input[type=\"checkbox\"]:checked:last").parent()[0];
        $(".mw-contributions-list input[type=\"checkbox\"]:checked:first").parent().nextUntil(last).children("input[type=\"checkbox\"]").prop("checked", true);
    });

    const api = new mw.Api();

    $("#contributions-rollback-button").click(async () => {
        const checked = $(".mw-contributions-list li :checkbox:checked");
        const reason = await oouiDialog.prompt(`<ul><li>选中了${checked.length}个页面</li><li>批量回退操作的编辑摘要：<code>xxx// MassRollback</code></li><li>空白则使用默认回退摘要，取消则不进行回退</li><li>管理员可自授权机器用户或在URL后添加<code>bot=1</code>以启用markbotedit。</li></ul><hr>请输入回退摘要：`, {
            title: "批量回退小工具",
            size: "medium",
            required: false,
        });
        if (reason === null) { return; }
        console.log("开始回退...");
        const user = mw.config.get("wgRelevantUserName");
        checked.each(function () {
            const title = this.getAttribute("data-title");
            try {
                api.postWithToken("rollback", {
                    action: "rollback",
                    format: "json",
                    title: title,
                    user: user,
                    markbot: mw.config.get("wgUserGroups").includes("sysop") && (mw.config.get("wgUserGroups").includes("flood") || document.URL.includes("bot=1")),
                    watchlist: "nochange",
                    tags: "Automation tool",
                    summary: reason ? `${reason} // MassRollback` : "// MassRollback",
                }).then((result) => {
                    console.log(`回退：${title}\n${result}`);
                });
            } catch (e) {
                console.log(`回退失败：${e}` instanceof Error ? e.stack.split("\n")[1].trim() : JSON.stringify(e));
            }
        });
    });

    $("#contributions-undo-button").click(async () => {
        const checked = $(".mw-contributions-list li :checkbox:checked");
        const reason = await oouiDialog.prompt(`<ul><li>选中了${checked.length}个页面</li><li>批量撤销操作的编辑摘要：<code>xxx// MassUndo</code></li><li>空白则使用默认撤销摘要，取消则不进行撤销</li></ul><hr>请输入撤销摘要：`, {
            title: "批量撤销小工具",
            size: "medium",
            required: false,
        });
        if (reason === null) { return; }
        console.log("开始撤销...");
        checked.each(function () {
            const title = this.getAttribute("data-title"),
                revid = this.getAttribute("data-revid");
            try {
                api.postWithToken("csrf", {
                    action: "edit",
                    format: "json",
                    title: title,
                    undo: revid,
                    tags: "Automation tool",
                    bot: mw.config.get("wgUserGroups").includes("flood"),
                    watchlist: "nochange",
                    summary: reason ? `${reason} // MassUndo` : "// MassUndo",
                }).then((result) => {
                    console.log(`撤销：${title}\n${result}`);
                });
            } catch (e) {
                console.log(`撤销失败：${e}` instanceof Error ? e.stack.split("\n")[1].trim() : JSON.stringify(e));
            }
        });
    });

    $("#contributions-registerdelete-button").click(async () => {
        const checked = $(".mw-contributions-list li :checkbox:checked");
        const username = mw.config.get("wgUserName");
        const reason = await oouiDialog.prompt(`<ul><li>选中了${checked.length}个页面</li><li>批量挂删操作的编辑摘要：<code>xxx// MassDelete</code></li><li>空白则使用默认摘要，取消则不进行挂删</li></ul><hr>请输入挂删摘要：`, {
            title: "批量挂删小工具",
            size: "medium",
            required: false,
        });
        if (reason === null) { return; }
        console.log("开始挂删...");
        checked.each(function () {
            const title = this.getAttribute("data-title");
            try {
                api.postWithToken("csrf", {
                    action: "edit",
                    format: "json",
                    title: title,
                    text: `<noinclude>{{即将删除|user=${username}|1=${reason}}}</noinclude>`,
                    tags: "Automation tool",
                    bot: mw.config.get("wgUserGroups").includes("flood"),
                    watchlist: "nochange",
                    summary: reason ? `${reason} // MassDelete` : "// MassDelete",
                }).then((result) => {
                    console.log(`挂删：${title}\n${result}`);
                });
            } catch (e) {
                console.log(`挂删失败：${e}` instanceof Error ? e.stack.split("\n")[1].trim() : JSON.stringify(e));
            }
        });
    });

    $("#contributions-revdel-button").click(async () => {
        const checked = $(".mw-contributions-list li :checkbox:checked");
        const reason = await oouiDialog.prompt(`<ul><li>选中了${checked.length}个页面，将删除版本内容和编辑摘要</li><li>批量版本删除的原因：<code>xxx// MassRevisionDelete</code></li><li>空白则使用默认原因，取消则不进行版本删除</li></ul><hr>请输入版本删除原因：`, {
            title: "批量版本删除小工具",
            size: "medium",
            required: false,
        });
        if (reason === null) { return; }
        console.log("开始版本删除...");
        checked.each(function () {
            const title = this.getAttribute("data-title"),
                revid = this.getAttribute("data-revid");
            try {
                api.postWithToken("csrf", {
                    action: "revisiondelete",
                    format: "json",
                    type: "revision",
                    target: title,
                    ids: revid,
                    tags: "Automation tool",
                    hide: "comment|content",
                    reason: reason ? `${reason} // MassRevisionDelete` : "// MassRevisionDelete",
                }).then((result) => {
                    console.log(`版本删除：${title}\n${result}`);
                });
            } catch (e) {
                console.log(`版本删除失败：${e}` instanceof Error ? e.stack.split("\n")[1].trim() : JSON.stringify(e));
            }
        });
    });
});