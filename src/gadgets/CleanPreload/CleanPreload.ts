import { getContent, consoleSuccess, consoleError } from '@/utils';

(() => {
    const { wgNamespaceNumber, wgRevisionId, wgArticleId, wgIsArticle, wgPageName } = mw.config.get();

    if (wgNamespaceNumber !== 0 || (wgRevisionId === 0 && wgArticleId === 0) || !wgIsArticle) {
        return;
    }

    mw.util
        .addPortletLink('p-cactions', '#', '清理预加载', 'clear-preload', '清理预加载', 'l')
        ?.addEventListener('click', async e => {
            e.preventDefault();
            const content = await getContent(),
                text = content.replace(/<!--[\s\S]*?-->/g, '');
            await new mw.Api()
                .postWithToken('csrf', {
                    action: 'edit',
                    title: wgPageName,
                    text,
                    summary: '[[User:SaoMikoto/js#快速移除预加载模板|移除预加载模板]]',
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
