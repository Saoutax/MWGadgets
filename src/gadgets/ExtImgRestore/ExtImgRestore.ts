import { getContent } from "@/utils/getContent.js";
import { extractImgStyle } from "./modules/extractImgStyle.js";
import { restoreImg } from "./modules/restoreImg.js";

(async () => {
    const { wgNamespaceNumber } = mw.config.get();
    const $brokenImages = $(".moe-img-error, .moe-img-blocked");

    if (wgNamespaceNumber === -1 || $brokenImages.length === 0) {
        return;
    }

    await getContent().then(content => {
        $brokenImages.each((index, element) => {
            const $this = $(element);
            const isLink = $this.is("a");
            const src = isLink ? $this.attr("href") || "" : $this.attr("data-src-input") || "";
            const style = extractImgStyle(content, src, index);
            restoreImg($this, src, style, isLink);
        });
    });
})();
