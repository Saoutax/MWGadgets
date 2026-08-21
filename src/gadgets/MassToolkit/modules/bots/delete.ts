import { deletePage, undeletePage } from '../api/mwApi';
import { InputType } from '../components/inputDialog';
import { LogSeverity } from '../components/progressWindow';
import { Bot, BotConfigurationDialog } from '../core/bot';
import type { PageInfo } from '../models/page';

interface DeleteOptions {
    pages: string[];
    delete: boolean;
    reason: string;
    deleteTalk: boolean;
}

/** 批量删除/恢复页面 */
export const deleteBot: Bot<DeleteOptions> = new Bot({
    name: 'DeleteBot',
    description: '批量删除/恢复页面',
    batchSize: 1,
    /** 处理单批页面：按配置删除或恢复。 */
    processBatch: async (pages: PageInfo[], options: DeleteOptions) => {
        const page = pages[0];
        if (!page) {
            return { severity: LogSeverity.ERROR, message: '没有可处理的页面' };
        }
        if (options.delete) {
            const result = await deletePage(page.title, options.reason, options.deleteTalk);
            return result.ok
                ? { severity: LogSeverity.SUCCESS, message: `${page.title} 已删除` }
                : { severity: LogSeverity.ERROR, message: `删除 ${page.title} 失败：${result.error}` };
        }
        const result = await undeletePage(page.title, options.reason, options.deleteTalk);
        return result.ok
            ? { severity: LogSeverity.SUCCESS, message: `${page.title} 已恢复` }
            : { severity: LogSeverity.ERROR, message: `恢复 ${page.title} 失败：${result.error}` };
    },
    /** 构造"删除/恢复"配置对话框。 */
    createConfigDialog: () =>
        new BotConfigurationDialog({
            inputOptions: [
                {
                    key: 'delete',
                    label: '删除页面（取消勾选则恢复）',
                    type: InputType.BOOLEAN,
                    defaultValue: true,
                },
                {
                    key: 'reason',
                    label: '删除/恢复原因',
                    type: InputType.TEXT,
                    defaultValue: '$bot：批量删除页面',
                    placeholder: '删除原因',
                },
                {
                    key: 'deleteTalk',
                    label: '删除/恢复讨论页',
                    type: InputType.BOOLEAN,
                },
            ],
        }),
    rights: ['delete'],
});
