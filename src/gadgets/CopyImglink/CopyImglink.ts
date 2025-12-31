import { domURL } from "./modules/dom.js";
import { sourceURL } from "./modules/source.js";

(() => {
    const { wgIsArticle, wgRevisionId, wgArticleId } = mw.config.get();

    if ((wgRevisionId === 0 && wgArticleId === 0) || !wgIsArticle) {
        return;
    }

    mw.util.addPortletLink("p-cactions", "#", "复制图片外链", "CopyImglink", "复制图片外链")?.addEventListener("click", async e => {
        e.preventDefault();

        try {
            const dom = domURL();
            const source = await sourceURL();

            const links = [...new Set([...dom, ...source])];

            const num = links.length;

            if (!num) {
                mw.notify("未找到外链图片。");
                return;
            }

            await navigator.clipboard.writeText(links.join("\n"));
            mw.notify(`已复制 ${num} 个外链图片到剪贴板。`, { type: "success" });

        } catch (err) {
            mw.notify("获取外链图片失败，请于控制台查看详情。", { type: "error" });
            console.log(`[CopyImgLink] 获取外链时发生错误：${err}`);
        }

    });

})();