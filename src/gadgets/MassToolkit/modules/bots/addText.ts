import { formatSummary, savePage } from '../api/mwApi';
import { fetchPageText } from '../api/pageInfo';
import { simpleAlert } from '../components/alertWindow';
import { InputType } from '../components/inputDialog';
import { LogSeverity } from '../components/progressWindow';
import { Bot, BotConfigurationDialog } from '../core/bot';
import type { PageInfo } from '../models/page';

interface AddTextOptions {
    pages: string[];
    textToAdd: string;
    position: 'top' | 'bottom';
    skipExisting: boolean;
    summary: string;
}

/** 在页面顶部或底部批量插入文本 */
export const addTextBot: Bot<AddTextOptions> = new Bot({
    name: 'AddTextBot',
    description: '在页面顶部或底部批量添加文本',
    /** 预取每批页面的正文。 */
    preprocessPages: pages => fetchPageText(pages),
    /** 处理单批页面：按位置在顶部或底部插入文本并保存。 */
    processBatch: async (pages: PageInfo[], options: AddTextOptions) => {
        const page = pages[0];
        if (!page) {
            return { severity: LogSeverity.ERROR, message: '没有可处理的页面' };
        }
        let newText = page.text ?? '';

        if (options.skipExisting && newText.includes(options.textToAdd)) {
            return {
                severity: LogSeverity.WARNING,
                message: `跳过 ${page.title}：页面已包含要添加的文本。`,
            };
        }

        if (options.position === 'top') {
            newText = options.textToAdd + newText.trimStart();
        } else {
            newText = newText.trimEnd() + options.textToAdd;
        }

        const summary = formatSummary(options.summary, { text: options.textToAdd });
        const saved = await savePage(page.title, newText, summary, true);
        return saved
            ? { severity: LogSeverity.SUCCESS, message: `${page.title} 已保存` }
            : { severity: LogSeverity.ERROR, message: `保存 ${page.title} 失败` };
    },
    /** 构造"添加文本"配置对话框。 */
    createConfigDialog: () =>
        new BotConfigurationDialog({
            inputOptions: [
                {
                    key: 'textToAdd',
                    label: '要添加的文本',
                    type: InputType.MULTILINE_TEXT,
                    placeholder: '输入要添加到页面的文本...',
                    rows: 5,
                },
                {
                    key: 'position',
                    label: '位置',
                    type: InputType.SELECT,
                    options: [
                        { data: 'top', label: '顶部' },
                        { data: 'bottom', label: '底部' },
                    ],
                    defaultValue: 'bottom',
                },
                {
                    key: 'skipExisting',
                    label: '页面已包含该文本时跳过',
                    type: InputType.BOOLEAN,
                },
                {
                    key: 'summary',
                    label: '编辑摘要',
                    type: InputType.TEXT,
                    defaultValue: '$bot：批量添加 $text',
                },
            ],
            /** 校验：要添加的文本不能为空。 */
            validator: (data: AddTextOptions) => {
                if (data.textToAdd.trim() === '') {
                    simpleAlert('输入无效', '要添加的文本不能为空。');
                    return false;
                }
                return true;
            },
        }),
    rights: ['edit'],
});
