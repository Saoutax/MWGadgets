import { edit } from './modules/edit';

(() => {
    const { wgNamespaceNumber, wgRevisionId, wgArticleId, wgIsArticle, wgUserName, wgRelevantUserName } =
        mw.config.get();

    if (
        wgNamespaceNumber !== 2 ||
        (wgRevisionId === 0 && wgArticleId === 0) ||
        !wgIsArticle ||
        wgUserName !== wgRelevantUserName
    ) {
        return;
    }

    mw.util
        .addPortletLink('p-cactions', '#', '清空页面', 'clear-userpage', '清空页面', 'r')
        ?.addEventListener('click', async e => {
            e.preventDefault();
            await edit();
        });
})();
