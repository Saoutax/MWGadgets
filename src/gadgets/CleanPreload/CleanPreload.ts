import clean from "./modules/clean.js";
import edit from "./modules/edit.js";
import { getContent } from "@/utils/getContent.js";

(() => {
    const { wgNamespaceNumber, wgRevisionId, wgArticleId, wgIsArticle } = mw.config.get();

    if (wgNamespaceNumber !== 0 || (wgRevisionId === 0 && wgArticleId === 0) || !wgIsArticle) {
        return;
    }

    mw.util.addPortletLink("p-cactions", "#", "清理预加载", "clear-preload", "清理预加载", "l")?.addEventListener("click", async e => {
        e.preventDefault();
        const content = await getContent();
        const text = clean(content);
        await edit(text);
    });
})();
