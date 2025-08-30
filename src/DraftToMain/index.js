if (mw.config.get("wgNamespaceNumber") === 2) { 
    $(mw.util.addPortletLink("p-cactions", "#", "快速转正", "move-to-main", "快速转正", "q")).on("click", function () {
        var userPageTitle = mw.config.get("wgPageName");
        var slashIndex = userPageTitle.lastIndexOf("/");

        if (slashIndex === -1) {
            mw.notify("标题获取失败");
            return;
        }

        var newTitle = userPageTitle.substring(slashIndex + 1);

        new mw.Api().postWithToken("csrf", {
            action: "move",
            from: userPageTitle,
            to: newTitle,
            reason: "编写完成",
            movetalk: "noleave",
            noredirect: true,
            tags: "Automation tool",
            format: "json"
        })
        .done(function () {
            mw.notify("页面已成功移动，即将跳转……");
            setTimeout(function () {
                window.location.href = mw.util.getUrl(newTitle);
            }, 2000);
        })
        .fail(function (err) {
                mw.notify("移动时出现错误：" + err + "。");
            })
    });
}