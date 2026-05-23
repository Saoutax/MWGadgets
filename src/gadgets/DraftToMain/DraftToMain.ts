import { consoleSuccess, consoleError } from '@/utils';

(() => {
    const { wgPageName, wgNamespaceNumber } = mw.config.get();
    const slashIndex = wgPageName.lastIndexOf('/');

    if (wgNamespaceNumber !== 2 || slashIndex === -1) {
        return;
    }

    const newPageName = wgPageName.substring(slashIndex + 1);

    mw.util
        .addPortletLink('p-cactions', '#', '快速转正', 'move-to-main', '快速转正', 'q')
        ?.addEventListener('click', async e => {
            e.preventDefault();
            await new mw.Api()
                .postWithToken('csrf', {
                    action: 'move',
                    from: wgPageName,
                    to: newPageName,
                    reason: '编写完成',
                    movetalk: 'noleave',
                    noredirect: true,
                    tags: 'Automation tool',
                })
                .then(() => {
                    consoleSuccess('移动');
                })
                .catch(error => {
                    consoleError('DraftToMain', error);
                });
        });
})();
