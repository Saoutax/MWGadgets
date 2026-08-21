/**
 * MediaWiki API 请求参数（formatversion 2 由 api 层统一追加）。
 */
export type MWApiParams = Record<string, string | number | boolean | undefined>;

/**
 * 单页查询结果（formatversion 2：query.pages 为数组、revisions 内容位于 .content）。
 */
export interface MWPage {
    /** 页面 ID */
    pageid: number;
    /** 名字空间编号 */
    ns: number;
    /** 页面标题 */
    title: string;
    /** 页面是否存在（不存在的页面为 true） */
    missing?: boolean;
    /** 修订版本列表（内容查询时存在） */
    revisions?: Array<{ content?: string }>;
}

/** 页面列表 */
export type MWPages = MWPage[];
