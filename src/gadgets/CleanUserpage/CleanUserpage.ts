import { consoleSuccess, consoleError } from '@/utils';

(() => {
    const { wgNamespaceNumber, wgRevisionId, wgArticleId, wgIsArticle, wgUserName, wgRelevantUserName, wgPageName } =
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
            await new mw.Api()
                .postWithToken('csrf', {
                    action: 'edit',
                    title: wgPageName,
                    text: '',
                    summary: '清空页面',
                    tags: 'Automation tool',
                })
                .then(() => {
                    consoleSuccess('清理');
                })
                .catch(error => {
                    consoleError('CleanPreload', error);
                });
        });
})();
