import { simpleAlert } from '../components/alertWindow';
import { InputType, type InputDepends } from '../components/inputDialog';
import type { InputConfig } from '../core/bot';

/** 正则相关配置 */
export interface RegexConfigOptions {
    /** 是否使用正则 */
    useRegex: boolean;
    /** 正则标志位 */
    regexFlags: string;
}

/**
 * 正则输入辅助：生成「使用正则」开关与标志位输入字段，并提供合法性校验。
 */
export class RegexHelper {
    /**
     * 生成「使用正则」开关与标志位输入字段。
     * @param enableKey 「使用正则」开关对应的配置键
     * @param flagsKey 标志位对应的配置键
     * @param defaults 可自定义标签与默认标志位
     */
    static createRegexInputGroup<T>(
        enableKey: Extract<keyof T, string>,
        flagsKey: Extract<keyof T, string>,
        defaults: {
            enableLabel?: string;
            flagsLabel?: string;
            defaultFlags?: string;
            extraDepends?: InputDepends[];
        } = {},
    ): InputConfig<T> {
        const depends: InputDepends[] = [{ key: enableKey }];
        depends.push(...(defaults.extraDepends ?? []));
        return [
            {
                key: enableKey,
                label: defaults.enableLabel ?? '使用正则表达式',
                type: InputType.BOOLEAN,
                depends: defaults.extraDepends ?? [],
            },
            {
                key: flagsKey,
                label: defaults.flagsLabel ?? '正则标志',
                type: InputType.TEXT,
                defaultValue: defaults.defaultFlags ?? 'gm',
                depends,
                help: new OO.ui.HtmlSnippet(
                    '正则标志（如 <i>i</i> 表示忽略大小写）。' +
                        '<a href="https://developer.mozilla.org/docs/Web/JavaScript/Guide/Regular_Expressions#advanced_searching_with_flags" target="_blank">更多信息</a>。',
                ),
            },
        ];
    }

    /**
     * 校验正则是否合法（仅开启正则时生效），非法时弹出提示并返回 false。
     * @param config 正则配置
     * @param text 正则文本
     */
    static regexValidator(config: RegexConfigOptions, text: string): boolean {
        if (config.useRegex) {
            try {
                new RegExp(text, config.regexFlags);
            } catch (error) {
                simpleAlert('正则表达式无效', (error as Error).message);
                return false;
            }
        }
        return true;
    }
}
