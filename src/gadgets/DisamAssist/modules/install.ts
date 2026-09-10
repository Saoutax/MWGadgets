import { shouldLoad } from './check';
import { start } from './start';

/**
 * 安装 DisamAssist。
 *
 * 先执行页面守卫，避免在无关页面加载 MediaWiki 模块；确认页面符合条件后，再等待标题解析器、API
 * 和 portlet 工具加载完成，最后创建页面入口。该函数由 gadget 入口在 DOM ready 后调用。
 *
 * @returns 模块加载和入口初始化完成后的 Promise
 */
const install = async (): Promise<void> => {
    if (!shouldLoad()) {
        return;
    }
    await mw.loader.using(['mediawiki.Title', 'mediawiki.api', 'mediawiki.util']);
    start();
};

export { install };
