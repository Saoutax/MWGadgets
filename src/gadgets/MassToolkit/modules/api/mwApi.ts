import { state } from '../models/state';
import type { UserGroup } from '../models/userGroup';
import type { MWApiParams } from '../types';
import { newErrorResult, type Result } from '../utils/result';

/** API 请求节流类型 */
type ThrottleType = 'read' | 'write' | 'download';

/**
 * 按类型记录上次请求时间，用于请求节流。
 */
class ThrottleControl {
    private lastAction: Record<ThrottleType, number> = { read: 0, write: 0, download: 0 };

    /**
     * 等待至距上次同类型请求至少 `time` 秒。
     * @param type 请求类型
     * @param time 间隔（秒）
     */
    async throttle(type: ThrottleType, time: number): Promise<void> {
        const now = Date.now();
        const sleepUntil = (this.lastAction[type] ?? 0) + time * 1000;
        if (sleepUntil > now) {
            await new Promise(resolve => setTimeout(resolve, sleepUntil - now));
        }
        this.lastAction[type] = Date.now();
    }
}

/**
 * MediaWiki API 封装：统一追加 formatversion 2、读写节流。
 */
export class Api {
    private readonly defaultParams: MWApiParams = { format: 'json', formatversion: 2 };
    readonly throttleControl = new ThrottleControl();

    /**
     * @param api 底层 mw.Api 实例
     */
    constructor(private readonly api: mw.Api = new mw.Api()) {}

    /**
     * 合并默认参数（format 与 formatversion 2）。
     * @param params 请求参数
     */
    private withDefaults(params: MWApiParams): MWApiParams {
        return { ...this.defaultParams, ...params };
    }

    /**
     * 节流等待；未指定时间时按类型读取全局配置。
     * @param type 请求类型
     * @param time 自定义间隔（秒），可选
     */
    async throttle(type: ThrottleType, time?: number): Promise<void> {
        const effective = time ?? (type === 'read' ? state.config.readThrottle : state.config.writeThrottle);
        await this.throttleControl.throttle(type, effective);
    }

    /**
     * 只读请求（GET + 读节流）。
     * @param params 请求参数
     */
    async get(params: MWApiParams): Promise<unknown> {
        await this.throttle('read');
        return this.api.get(this.withDefaults(params));
    }

    /**
     * 写请求（POST + 写节流，不带令牌）。
     * @param params 请求参数
     */
    async post(params: MWApiParams): Promise<unknown> {
        await this.throttle('write');
        return this.api.post(this.withDefaults(params));
    }

    /**
     * 带 csrf 令牌的写请求。
     * @param params 请求参数
     */
    async postWithToken(params: MWApiParams): Promise<unknown> {
        await this.throttle('write');
        return this.api.postWithToken('csrf', this.withDefaults(params));
    }
}

/** 全局 API 单例 */
export const API = new Api();

/**
 * 替换编辑摘要中的占位符：`$bot` 与附加参数（如 `$text`）。
 * @param summary 摘要模板
 * @param additionalParameters 附加参数替换表
 */
export function formatSummary(summary: string, additionalParameters: Record<string, string> = {}): string {
    let result = summary.replace('$bot', state.config.summaryBot);
    for (const key in additionalParameters) {
        result = result.replace(`$${key}`, additionalParameters[key] ?? '');
    }
    return result;
}

/**
 * 批量清除缓存（每次最多 50 页）。
 * @param titles 页面标题
 */
export async function purge(titles: string[], api = API): Promise<boolean> {
    if (titles.length === 0) {
        return false;
    }
    if (titles.length > 50) {
        console.error('Cannot purge more than 50 pages at once');
        return false;
    }
    try {
        const result = (await api.post({ action: 'purge', titles: titles.join('|') })) as {
            purge: Record<string, unknown>[];
        };
        // purge API 对每个标题返回一项；仅当每项都标记 purged 才视为成功（missing/错误项视为失败）
        return result.purge.every(entry => 'purged' in entry);
    } catch (error) {
        console.error(`Failed to purge pages: ${titles}`, error);
        return false;
    }
}

/**
 * 保存页面。
 * @param title 页面标题
 * @param text 新的 wikitext
 * @param summary 编辑摘要
 * @param minor 是否标记为小编辑
 * @param bot 是否标记为 bot 编辑
 * @returns 是否保存成功
 */
export async function savePage(
    title: string,
    text: string,
    summary = '$bot: automated edit',
    minor = true,
    bot = true,
    api = API,
): Promise<boolean> {
    try {
        const result = (await api.postWithToken({
            action: 'edit',
            title,
            text,
            summary: formatSummary(summary),
            minor,
            bot,
        })) as { edit?: { result?: string } };
        return result.edit?.result === 'Success';
    } catch (error) {
        console.error('Failed to save page:', title, error);
        return false;
    }
}

/**
 * 删除页面。
 * @param title 页面标题
 * @param reason 删除原因
 * @param deleteTalk 是否一并删除讨论页
 * @returns 成功返回 { ok: true }，失败返回 { ok: false, error }
 */
export async function deletePage(
    title: string,
    reason: string,
    deleteTalk = false,
    bot = true,
    api = API,
): Promise<Result<boolean>> {
    try {
        await api.postWithToken({
            action: 'delete',
            title,
            reason: formatSummary(reason),
            deletetalk: deleteTalk,
            bot,
        });
        return { ok: true, value: true };
    } catch (error) {
        console.error('Failed to delete page:', title, error);
        return newErrorResult(error instanceof Error ? error.message : String(error));
    }
}

/**
 * 恢复已删除的页面。
 * @param title 页面标题
 * @param reason 恢复原因
 * @param undeleteTalk 是否一并恢复讨论页
 */
export async function undeletePage(
    title: string,
    reason: string,
    undeleteTalk = false,
    bot = true,
    api = API,
): Promise<Result<boolean>> {
    try {
        await api.postWithToken({
            action: 'undelete',
            title,
            reason: formatSummary(reason),
            undeletetalk: undeleteTalk,
            bot,
        });
        return { ok: true, value: true };
    } catch (error) {
        console.error('Failed to undelete page:', title, error);
        return newErrorResult(error instanceof Error ? error.message : String(error));
    }
}

/**
 * 移动页面。
 * @param from 原标题
 * @param to 目标标题
 * @param options 移动选项（原因、是否移动讨论页/子页、是否不创建重定向）
 */
export async function movePage(
    from: string,
    to: string,
    options: { reason: string; moveTalk: boolean; moveSubpages: boolean; noRedirect: boolean; bot: boolean },
    api = API,
): Promise<Result<boolean>> {
    try {
        await api.postWithToken({
            action: 'move',
            from,
            to,
            reason: formatSummary(options.reason),
            movetalk: options.moveTalk,
            movesubpages: options.moveSubpages,
            noredirect: options.noRedirect,
            bot: options.bot,
        });
        return { ok: true, value: true };
    } catch (error) {
        console.error('Failed to move page:', from, 'to:', to, error);
        return newErrorResult(error instanceof Error ? error.message : String(error));
    }
}

/**
 * 站点信息响应（meta=siteinfo）。
 */
export interface SiteInfoResponse {
    query: {
        /** 全部名字空间（formatversion 2 下为数组） */
        namespaces: Array<{
            id: number;
            case?: string;
            canonical?: string;
            name?: string;
            '*': string;
            subpages?: string;
            defaultcontentmodel?: string;
        }>;
        /** 全部用户组 */
        usergroups: UserGroup[];
    };
}

let cachedSiteInfo: SiteInfoResponse | undefined;
let siteInfoPromise: Promise<SiteInfoResponse> | undefined;

/**
 * 获取站点信息（namespaces + usergroups），带缓存。
 */
export async function getSiteInfo(): Promise<SiteInfoResponse> {
    if (cachedSiteInfo) {
        return cachedSiteInfo;
    }
    if (siteInfoPromise) {
        return siteInfoPromise;
    }
    siteInfoPromise = (async () => {
        try {
            const result = (await API.get({
                action: 'query',
                meta: 'siteinfo',
                siprop: 'namespaces|usergroups',
            })) as SiteInfoResponse;
            cachedSiteInfo = result;
            return result;
        } finally {
            siteInfoPromise = undefined;
        }
    })();
    return siteInfoPromise;
}
