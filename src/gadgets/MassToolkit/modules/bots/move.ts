import { formatSummary, movePage } from '../api/mwApi';
import { simpleAlert } from '../components/alertWindow';
import { InputType } from '../components/inputDialog';
import { LogSeverity } from '../components/progressWindow';
import { Bot, BotConfigurationDialog } from '../core/bot';
import type { PageInfo } from '../models/page';
import { getUserRights } from '../models/userRight';
import { RegexHelper, type RegexConfigOptions } from '../utils/regexHelper';

interface MoveConfig extends RegexConfigOptions {
    pages: string[];
    manualInput: boolean;
    originalText: string;
    replacementText: string;
    targetTitles: string;
    summary: string;
    moveTalk: boolean;
    moveSubpages: boolean;
    noRedirect: boolean;
    pageMapping?: Record<string, string>;
}

/** 批量移动页面（按替换规则或手动目标标题列表） */
export const moveBot: Bot<MoveConfig> = new Bot({
    name: 'MoveBot',
    description: '批量移动页面',
    /** 构造"移动"配置对话框。 */
    createConfigDialog: () =>
        new BotConfigurationDialog({
            inputOptions: [
                {
                    key: 'manualInput',
                    label: '手动输入目标标题列表（而不是使用替换规则）',
                    type: InputType.BOOLEAN,
                },
                {
                    key: 'originalText',
                    label: '标题中的查找文本',
                    type: InputType.TEXT,
                    placeholder: '在页面标题中查找的文本',
                    depends: { key: 'manualInput', invert: true },
                    help: '使用正则时直接输入正则本身，无需 /regex/ 包裹。',
                },
                {
                    key: 'replacementText',
                    label: '替换为',
                    type: InputType.TEXT,
                    placeholder: '替换文本',
                    depends: { key: 'manualInput', invert: true },
                },
                ...RegexHelper.createRegexInputGroup('useRegex', 'regexFlags', {
                    extraDepends: [{ key: 'manualInput', invert: true }],
                }),
                {
                    key: 'targetTitles',
                    label: '目标标题',
                    type: InputType.MULTILINE_TEXT,
                    placeholder: '每行输入一个目标页面标题（与源页面顺序一致）',
                    rows: 10,
                    depends: { key: 'manualInput' },
                    help: '每行输入一个目标标题，顺序需与第一步选择的源页面一致。',
                },
                { key: 'moveTalk', label: '同时移动讨论页', type: InputType.BOOLEAN, defaultValue: false },
                { key: 'moveSubpages', label: '同时移动子页面', type: InputType.BOOLEAN, defaultValue: true },
                {
                    key: 'noRedirect',
                    label: `不创建重定向（需要 suppressredirect 权限），您${
                        getUserRights()?.includes('suppressredirect') ? '拥有' : '不拥有'
                    }该权限。`,
                    type: InputType.BOOLEAN,
                    help: '该权限通常仅管理员拥有。',
                },
                {
                    key: 'summary',
                    label: '编辑摘要',
                    type: InputType.TEXT,
                    defaultValue: '$bot：批量移动页面 [[$from]] → [[$to]]',
                },
            ],
            /** 校验：手动模式目标数量须与源页面一致；规则模式查找文本不能为空。 */
            validator: (config: MoveConfig) => {
                if (config.manualInput) {
                    const targetLines = config.targetTitles.split('\n').filter(title => title.trim());
                    if (targetLines.length !== config.pages.length) {
                        simpleAlert(
                            '输入无效',
                            `目标标题数量（${targetLines.length}）必须与源页面数量（${config.pages.length}）一致`,
                        );
                        return false;
                    }
                    config.pageMapping = {};
                    for (let i = 0; i < config.pages.length; i++) {
                        config.pageMapping[config.pages[i]!] = targetLines[i]!;
                    }
                    return true;
                }
                if (config.originalText === '') {
                    simpleAlert('输入无效', '标题中的查找文本不能为空');
                    return false;
                }
                return RegexHelper.regexValidator(config, config.originalText);
            },
        }),
    /** 处理单批页面：按规则或映射计算目标标题并移动。 */
    processBatch: async (pages: PageInfo[], config: MoveConfig) => {
        const page = pages[0];
        if (!page) {
            return { severity: LogSeverity.ERROR, message: '没有可处理的页面' };
        }
        let targetTitle: string;
        if (config.manualInput) {
            targetTitle = config.pageMapping![page.title]!;
        } else if (config.useRegex) {
            targetTitle = page.title.replace(
                new RegExp(config.originalText, config.regexFlags),
                config.replacementText,
            );
        } else {
            targetTitle = page.title.split(config.originalText).join(config.replacementText);
        }

        if (page.title === targetTitle) {
            return { severity: LogSeverity.WARNING, message: `跳过 ${page.title}（目标标题相同）` };
        }

        const summary = formatSummary(config.summary, { from: page.title, to: targetTitle });
        const moveResult = await movePage(page.title, targetTitle, {
            reason: summary,
            moveTalk: config.moveTalk,
            moveSubpages: config.moveSubpages,
            noRedirect: config.noRedirect,
            bot: true,
        });
        return moveResult.ok
            ? { severity: LogSeverity.SUCCESS, message: `${page.title} 已移动到 ${targetTitle}` }
            : {
                  severity: LogSeverity.ERROR,
                  message: `移动 ${page.title} 到 ${targetTitle} 失败：${moveResult.error}`,
              };
    },
});
