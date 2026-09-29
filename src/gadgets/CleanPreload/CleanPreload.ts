import { getContent, log } from '@/utils';

const DIALOG_MODULES = ['oojs-ui', 'ext.gadget.libOOUIDialog'];
const CONFIRM_TITLE = '清理预加载';
const CONFIRM_MESSAGE = '确定要移除该页面的全部预加载模板吗？此操作会无差别移除页面内所有注释。';

(() => {
    const { wgNamespaceNumber, wgRevisionId, wgArticleId, wgIsArticle, wgPageName } = mw.config.get();

    if (wgNamespaceNumber !== 0 || (wgRevisionId === 0 && wgArticleId === 0) || !wgIsArticle) {
        return;
    }

    mw.util
        .addPortletLink('p-cactions', '#', '清理预加载', 'clear-preload', '清理预加载', 'l')
        ?.addEventListener('click', async e => {
            e.preventDefault();

            try {
                await mw.loader.using(DIALOG_MODULES);
            } catch (error) {
                console.error('[CleanPreload] 弹窗模块加载失败', error);
                mw.notify('界面组件加载失败，请刷新页面后重试。', { type: 'error' });
                return;
            }

            const confirmed = await oouiDialog.confirm($('<div>').text(CONFIRM_MESSAGE), {
                title: CONFIRM_TITLE,
                size: 'medium',
            });
            if (!confirmed) {
                return;
            }

            const content = await getContent(),
                text = content.replace(/<!--[\s\S]*?-->/g, '');
            await new mw.Api()
                .postWithToken('csrf', {
                    action: 'edit',
                    title: wgPageName,
                    text,
                    summary: '[[User:SaoMikoto/js#快速移除预加载模板|移除预加载模板]]',
                    tags: 'Automation tool',
                    watchlist: 'nochange',
                })
                .then(() => {
                    log.info('清理');
                })
                .catch(error => {
                    log.error('CleanPreload', error);
                });
        });
})();
