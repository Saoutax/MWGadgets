import { fetchPageContent } from './api';
import { CONFIG_PAGE } from './constants';
import type { ConfigResult, ParamType, TemplateEntry, TemplateParam, UserMessagesConfig } from './types';

/** 合法的控件类型集合。 */
const PARAM_TYPES: ParamType[] = ['page', 'text', 'multiline'];

/** 模块级预取 promise（幂等）。 */
let prefetch: Promise<ConfigResult> | null = null;

/** 预取结果快照，未落定时为 null。 */
let settled: ConfigResult | null = null;

/** 判断是否为非空字符串。 */
const isNonEmptyString = (value: unknown): value is string => {
    return typeof value === 'string' && value.trim() !== '';
};

/** 校验单个参数定义，非法则返回 null。 */
const toTemplateParam = (raw: unknown): TemplateParam | null => {
    if (typeof raw !== 'object' || raw === null) {
        return null;
    }
    const { key, label, type, required, default: defaultValue } = raw as Record<string, unknown>;
    if (!isNonEmptyString(key) || !isNonEmptyString(label)) {
        return null;
    }
    const param: TemplateParam = { key, label };
    if (typeof type === 'string' && (PARAM_TYPES as string[]).includes(type)) {
        param.type = type as ParamType;
    }
    if (typeof required === 'boolean') {
        param.required = required;
    }
    if (typeof defaultValue === 'string') {
        param.default = defaultValue;
    }
    return param;
};

/** 校验单个模板条目，非法则返回 null。 */
const toTemplateEntry = (raw: unknown): TemplateEntry | null => {
    if (typeof raw !== 'object' || raw === null) {
        return null;
    }
    const { title, template, summary, parameters } = raw as Record<string, unknown>;
    if (!isNonEmptyString(title) || !isNonEmptyString(template)) {
        return null;
    }
    const entry: TemplateEntry = {
        title,
        template,
        summary: typeof summary === 'string' ? summary : '',
    };
    if (Array.isArray(parameters)) {
        entry.parameters = parameters.map(toTemplateParam).filter((param): param is TemplateParam => param !== null);
    }
    return entry;
};

/**
 * 解析并校验配置页内容。非法条目静默丢弃；全部非法时视为失败。
 * @param raw 配置页的原始文本
 */
const parseConfig = (raw: string): ConfigResult => {
    if (raw.trim() === '') {
        return { ok: false, message: `页面 ${CONFIG_PAGE} 不存在或内容为空` };
    }

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch (error) {
        return { ok: false, message: `JSON 解析失败：${error instanceof Error ? error.message : String(error)}` };
    }

    const templates = (parsed as { templates?: unknown } | null)?.templates;
    if (!Array.isArray(templates)) {
        return { ok: false, message: `${CONFIG_PAGE} 缺少 templates 数组` };
    }

    const valid = templates.map(toTemplateEntry).filter((entry): entry is TemplateEntry => entry !== null);
    if (valid.length === 0) {
        return { ok: false, message: `${CONFIG_PAGE} 的模板列表为空或格式不正确` };
    }
    return { ok: true, config: { templates: valid } };
};

/** 读取并校验 window.UserMessages.templates，非法条目静默丢弃。 */
const parseCustomTemplates = (): TemplateEntry[] => {
    const raw = window.UserMessages?.templates;
    if (!Array.isArray(raw)) {
        return [];
    }
    return raw.map(toTemplateEntry).filter((entry): entry is TemplateEntry => entry !== null);
};

/** 合并预置与自定义模板：同名 title 由自定义覆盖预置，自定义统一置于末尾。 */
const mergeTemplates = (preset: TemplateEntry[], custom: TemplateEntry[]): TemplateEntry[] => {
    const customTitles = new Set(custom.map(entry => entry.title));
    const kept = preset.filter(entry => !customTitles.has(entry.title));
    return [...kept, ...custom];
};

/**
 * 启动模板配置预取。幂等，入口初始化时调用一次即可。
 * 预置（配置页）与自定义（window.UserMessages.templates）在此合并：
 * 自定义追加在预置之后并覆盖同名项；配置页失败但有自定义时降级为仅用自定义。
 * 永不 reject：失败会被转成 { ok: false } 结果。
 */
const prefetchConfig = (): Promise<ConfigResult> => {
    prefetch ??= (async (): Promise<ConfigResult> => {
        let preset: ConfigResult;
        try {
            preset = parseConfig(await fetchPageContent(CONFIG_PAGE));
        } catch (error) {
            preset = { ok: false, message: error instanceof Error ? error.message : String(error) };
        }

        const custom = parseCustomTemplates();
        if (preset.ok) {
            settled = { ok: true, config: { templates: mergeTemplates(preset.config.templates, custom) } };
        } else if (custom.length > 0) {
            settled = { ok: true, config: { templates: custom } };
        } else {
            settled = preset;
        }
        return settled;
    })();
    return prefetch;
};

/**
 * 取预取结果快照，供入口在打开对话框前做同步判断。
 * @returns 已落定的结果；尚未落定时为 null
 */
const getSettledConfig = (): ConfigResult | null => {
    return settled;
};

/**
 * 按 title 查找模板。
 * @param config 配置
 * @param title 模板 title
 */
const findTemplate = (config: UserMessagesConfig, title: string): TemplateEntry | undefined => {
    return config.templates.find(entry => entry.title === title);
};

export { findTemplate, getSettledConfig, parseConfig, prefetchConfig };
