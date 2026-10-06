import { injectButtons } from './modules/inject';

/**
 * 本小工具依赖的 ResourceLoader 模块，对应源仓库 definition.yaml 里的 dependencies。
 * 本仓库没有声明式清单，改为显式加载。
 */
const RELOADER_MODULES = [
    'ext.gadget.libDiscussionUtil',
    'ext.gadget.libOOUIDialog',
    'ext.gadget.site-lib',
    'mediawiki.api',
    'mediawiki.ForeignApi',
    'mediawiki.util',
];

$(() => {
    if (mw.config.get('wgPageName') !== '萌娘百科_talk:讨论版/操作申请') {
        return;
    }

    $('#mw-notification-area').appendTo('body');

    void mw.loader.using(RELOADER_MODULES).then(
        () => {
            try {
                injectButtons();
                window.libDiscussionUtil.onContentChange(injectButtons);
            } catch (error) {
                console.error('[DeleteRequestedPage] 注入失败:', error);
            }
        },
        (error: unknown) => {
            console.error('[DeleteRequestedPage] 依赖加载失败:', error);
        },
    );
});
