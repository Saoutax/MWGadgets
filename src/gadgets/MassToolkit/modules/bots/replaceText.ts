import { formatSummary, savePage } from '../api/mwApi';
import { fetchPageText } from '../api/pageInfo';
import { simpleAlert } from '../components/alertWindow';
import { showDiffDialog } from '../components/diff';
import { InputType } from '../components/inputDialog';
import { LogSeverity } from '../components/progressWindow';
import { Bot, BotConfigurationDialog } from '../core/bot';
import type { PageInfo } from '../models/page';
import { RegexHelper, type RegexConfigOptions } from '../utils/regexHelper';

interface ReplacementConfig extends RegexConfigOptions {
    pages: string[];
    originalText: string;
    replacementText: string;
    summary: string;
}

interface ReplaceTextState {
    acceptAll?: boolean;
}

/** 批量查找替换页面文本（可预览差异） */
export const replaceTextBot: Bot<ReplacementConfig, ReplaceTextState> = new Bot({
    name: 'ReplaceTextBot',
    description: '查找并替换文本',
    /** 预取每批页面的正文。 */
    preprocessPages: pages => fetchPageText(pages),
    /** 构造"查找替换"配置对话框。 */
    createConfigDialog: () =>
        new BotConfigurationDialog({
            inputOptions: [
                {
                    key: 'originalText',
                    label: '查找',
                    type: InputType.MULTILINE_TEXT,
                    placeholder: '要查找的文本',
                    rows: 5,
                    help: '使用正则时直接输入正则本身，无需 /regex/ 包裹。换行使用 \\n。',
                },
                {
                    key: 'replacementText',
                    label: '替换为',
                    type: InputType.MULTILINE_TEXT,
                    placeholder: '替换为',
                    rows: 5,
                    help: '换行请直接按回车键，无需输入 \\n。',
                },
                ...RegexHelper.createRegexInputGroup('useRegex', 'regexFlags'),
                {
                    key: 'summary',
                    label: '编辑摘要',
                    type: InputType.TEXT,
                    defaultValue: '$bot：替换 $original 为 $new',
                },
            ],
            /** 校验：查找文本不能为空且正则合法。 */
            validator: (config: ReplacementConfig) => {
                if (config.originalText === '') {
                    simpleAlert('输入无效', '要替换的文本不能为空');
                    return false;
                }
                return RegexHelper.regexValidator(config, config.originalText);
            },
        }),
    /** 处理单批页面：执行查找替换，必要时弹出差异确认后保存。 */
    processBatch: async (pages: PageInfo[], config: ReplacementConfig, state: ReplaceTextState, bot) => {
        const page = pages[0];
        if (!page) {
            return { severity: LogSeverity.ERROR, message: '没有可处理的页面' };
        }
        const sourceText = page.text ?? '';
        const text = config.useRegex
            ? sourceText.replace(new RegExp(config.originalText, config.regexFlags), config.replacementText)
            : sourceText.split(config.originalText).join(config.replacementText);

        if (sourceText === text) {
            return { severity: LogSeverity.INFO, message: `页面 ${page.title} 未发生更改` };
        }

        if (!state.acceptAll) {
            const result = await showDiffDialog(page.title, sourceText, text);
            switch (result.action) {
                case 'accept':
                    break;
                case 'acceptAll':
                    state.acceptAll = true;
                    break;
                case 'skip':
                    return { severity: LogSeverity.INFO, message: `已跳过 ${page.title}` };
                case 'cancel':
                    bot.cancel();
                    return { severity: LogSeverity.WARNING, message: '用户取消了文本替换' };
            }
        }

        const summary = formatSummary(config.summary, {
            original: config.originalText,
            new: config.replacementText,
        });
        const saved = await savePage(page.title, text, summary, true);
        return saved
            ? { severity: LogSeverity.SUCCESS, message: `${page.title} 已保存` }
            : { severity: LogSeverity.ERROR, message: `保存 ${page.title} 失败` };
    },
    rights: ['edit'],
});
