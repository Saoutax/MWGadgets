import { log } from '@/utils';

(() => {
    const { wgPageName, wgNamespaceNumber } = mw.config.get();
    const slashIndex = wgPageName.lastIndexOf('/');

    if (wgNamespaceNumber !== 2 || slashIndex === -1) {
        return;
    }

    const newPageName = wgPageName.substring(slashIndex + 1);

    const moveToMain = async () => {
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
                log.info('移动');
            })
            .catch(error => {
                log.error('DraftToMain', error);
            });
    };

    mw.util
        .addPortletLink('p-cactions', '#', '快速转正', 'move-to-main', '快速转正', 'q')
        ?.addEventListener('click', e => {
            e.preventDefault();
            void moveToMain();
        });
})();
