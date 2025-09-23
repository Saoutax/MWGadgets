"use strict";

(async () => {
    await $.ready;
    await mw.loader.using(["mediawiki.util", "mediawiki.api"]);

    const api = new mw.Api();
    const title = mw.config.get("wgPageName");

    const portletLink = mw.util.addPortletLink("p-cactions", "#", "复制图片外链", "CopyImglink", "复制图片外链");

    $(portletLink).on("click", async e => {
        e.preventDefault();

        try {
            const results = new Set();

            document.querySelectorAll(".moe-img-error[data-src-input]").forEach(el => {
                results.add(el.getAttribute("data-src-input"));
            });

            const data = await api.get({
                action: "query",
                prop: "revisions",
                rvprop: "content",
                titles: title,
                formatversion: 2
            });

            const content = data.query.pages[0].revisions[0].content || "";
            const regex = /\bhttps?:\/\/[^\s<>"]+\.(?:png|jpe?g|gif|svg|webp)/gi;
            (content.match(regex) || []).forEach(url => results.add(url));

            const uniqueLinks = [...results];

            if (!uniqueLinks.length) {
                mw.notify("未找到外链图片。");
                return;
            }

            await navigator.clipboard.writeText(uniqueLinks.join("\n"));
            mw.notify(`已复制 ${uniqueLinks.length} 个外链图片链接到剪贴板。`);

        } catch (err) {
            console.error(err);
            mw.notify("获取外链图片出错。");
        }
    });
})();
