$(function() {
    if (mw.config.get("wgNamespaceNumber") !== 0
    || mw.config.get("wgRevisionId") === 0 && mw.config.get("wgArticleId") === 0
    || !mw.config.get("wgIsArticle") ) {
        return;
    }

    const link = mw.util.addPortletLink("p-cactions", "#", "清理预加载", "clear-preload", "清理预加载", "l");

    $(link).on("click", function(e) {
        e.preventDefault();
        const pageName = mw.config.get("wgPageName");
        const api = new mw.Api();

        api.get({
            action: "query",
            titles: pageName,
            prop: "revisions",
            rvprop: "content",
            formatversion: "2"
        }).then(function(data) {
            if (!data.query || !data.query.pages || data.query.pages.length === 0) {
                throw new Error("无法获取页面数据");
            }
            const page = data.query.pages[0];
            const content = page.revisions[0].content;
            const newContent = content.replace(/<!--[\s\S]*?-->/g, "");
            if (content === newContent) {
                mw.notify("未找到需要清理的预加载内容");
                return;
            }
            return api.postWithToken("csrf", {
                action: "edit",
                title: pageName,
                text: newContent,
                summary: "[[User:SaoMikoto/js#快速移除预加载模板|移除预加载模板]]",
                tags: "Automation tool",
                watchlist: "nochange"
            });
        }).then(function() {
            mw.notify("清理完成，即将刷新页面...");
            setTimeout(function() {
                location.reload();
            }, 2000);
        }).catch(function(error) {
            mw.notify("操作失败: " + error);
            console.error("清理预加载出错：", error);
        });
    });
});