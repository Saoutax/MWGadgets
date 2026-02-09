import { move } from "./modules/move";
(() => {
    const { wgPageName, wgNamespaceNumber } = mw.config.get();
    const slashIndex = wgPageName.lastIndexOf("/");

    if (wgNamespaceNumber !== 2 || slashIndex === -1) {
        return;
    }

    const newPageName = wgPageName.substring(slashIndex + 1);

    mw.util.addPortletLink("p-cactions", "#", "快速转正", "move-to-main", "快速转正", "q")?.addEventListener("click", async e => {
        e.preventDefault();
        await move(wgPageName, newPageName);
    });
})();
