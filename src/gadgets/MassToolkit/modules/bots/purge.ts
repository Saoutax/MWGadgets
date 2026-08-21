import { purge, savePage } from '../api/mwApi';
import { fetchPageText } from '../api/pageInfo';
import { InputType } from '../components/inputDialog';
import { LogSeverity } from '../components/progressWindow';
import { Bot, BotConfigurationDialog } from '../core/bot';
import type { PageInfo } from '../models/page';

interface PurgeOptions {
    pages: string[];
    nullEdit: boolean;
}

/** 批量清除缓存或执行空编辑 */
export const purgeBot: Bot<PurgeOptions> = new Bot({
    name: 'PurgeBot',
    description: '清除缓存或执行空编辑',
    /** 批大小：空编辑逐页处理，常规清除缓存每批 50 页。 */
    batchSize: (config: PurgeOptions) => (config.nullEdit ? 1 : 50),
    /** 预处理：空编辑时预取正文，常规清除缓存原样透传。 */
    preprocessPages: (pages, config) => (config.nullEdit ? fetchPageText(pages) : pages),
    /** 处理单批页面：空编辑保存或调用 purge API 清除缓存。 */
    processBatch: async (pages: PageInfo[], options: PurgeOptions) => {
        if (options.nullEdit) {
            const page = pages[0];
            if (!page) {
                return { severity: LogSeverity.ERROR, message: '没有可处理的页面' };
            }
            const saved = await savePage(page.title, page.text ?? '', '$bot：空编辑', true, true);
            return saved
                ? { severity: LogSeverity.SUCCESS, message: `${page.title} 已空编辑` }
                : { severity: LogSeverity.ERROR, message: `空编辑 ${page.title} 失败` };
        }
        const titles = pages.map(page => page.title);
        const purged = await purge(titles);
        return purged
            ? { severity: LogSeverity.SUCCESS, message: `已清除 ${titles.length} 个页面的缓存` }
            : { severity: LogSeverity.ERROR, message: `清除批量缓存失败：${titles.join(', ')}` };
    },
    /** 构造"清除缓存/空编辑"配置对话框。 */
    createConfigDialog: () =>
        new BotConfigurationDialog({
            inputOptions: [
                {
                    key: 'nullEdit',
                    label: '使用空编辑代替清除缓存',
                    type: InputType.BOOLEAN,
                    help: '空编辑会不改变内容地保存页面，从而刷新缓存。常规清除缓存使用 purge API，速度更快。',
                },
            ],
        }),
    rights: ['purge'],
});
