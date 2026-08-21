import { PageInfo } from '../models/page';
import { cachePageInfo, getCachedPageInfo } from '../models/state';
import type { MWApiParams } from '../types';
import { API } from './mwApi';

/**
 * query API 响应中的页面节点（formatversion 2 下为数组形式）。
 */
interface ApiQueryPage {
    pageid?: number;
    ns: number;
    title: string;
    missing?: boolean;
    revisions?: Array<{
        content?: string;
        slots?: { main?: { content?: string; '*': string } };
    }>;
    imageinfo?: Array<{ url?: string }>;
    categories?: Array<{ ns: number; title: string }>;
}

/**
 * 批量抓取页面基本信息（prop=info），自动分页（每批最多 50），命中缓存直接复用。
 * @param pageTitles 页面标题
 * @returns 存在的页面信息列表
 */
export async function fetchPageInfo(pageTitles: string[], api = API): Promise<PageInfo[]> {
    if (pageTitles.length === 0) {
        return [];
    }
    const results: PageInfo[] = [];
    const remaining: string[] = [];
    for (const title of pageTitles) {
        const cached = getCachedPageInfo(title);
        if (cached) {
            results.push(cached);
        } else {
            remaining.push(title);
        }
    }
    const batchSize = 50;
    for (let i = 0; i < remaining.length; i += batchSize) {
        const batch = remaining.slice(i, i + batchSize);
        const response = (await api.get({
            action: 'query',
            titles: batch.join('|'),
            prop: 'info',
        })) as { query?: { pages?: ApiQueryPage[] } };
        const pages = response.query?.pages;
        if (!pages) {
            continue;
        }
        for (const page of pages) {
            // formatversion 2：pages 为数组，不存在的页面带 missing: true
            if (page.missing || page.pageid === undefined) {
                continue;
            }
            const info = new PageInfo({ title: page.title, pageid: page.pageid, ns: page.ns });
            results.push(info);
            cachePageInfo(info);
        }
    }
    return results;
}

/**
 * 对页面批量执行 prop 查询并逐页回调处理。
 * @param pages 目标页面
 * @param queryParams 基础查询参数
 * @param processPage 单页处理回调
 */
async function* fetchPagePropBatch(
    pages: PageInfo[],
    queryParams: MWApiParams,
    processPage: (page: PageInfo, apiPage: ApiQueryPage) => void,
    api = API,
): AsyncGenerator<PageInfo> {
    const batchSize = 50;
    for (let i = 0; i < pages.length; i += batchSize) {
        const batch = pages.slice(i, i + batchSize);
        const titles = batch.map(p => p.title).join('|');
        const titleMap = new Map(batch.map(p => [p.title, p]));
        const response = (await api.get({ ...queryParams, titles })) as {
            query?: { pages?: ApiQueryPage[]; normalized?: Array<{ from: string; to: string }> };
        };
        const query = response.query;
        if (!query?.pages) {
            continue;
        }
        if (query.normalized) {
            for (const norm of query.normalized) {
                const original = titleMap.get(norm.from);
                if (original) {
                    titleMap.set(norm.to, original);
                }
            }
        }
        for (const apiPage of query.pages) {
            const pageInfo = titleMap.get(apiPage.title);
            if (!pageInfo) {
                continue;
            }
            pageInfo.ns = apiPage.ns;
            processPage(pageInfo, apiPage);
            yield pageInfo;
        }
    }
}

/**
 * 抓取页面 wikitext 内容（写入 page.text）。
 * @param pages 目标页面
 */
export async function* fetchPageText(pages: PageInfo[], api = API): AsyncGenerator<PageInfo> {
    yield* fetchPagePropBatch(
        pages,
        { action: 'query', prop: 'revisions', rvprop: 'content' },
        (pageInfo, apiPage) => {
            const rev = apiPage.revisions?.[0];
            // formatversion 2 下无 rvslots 时内容位于 revisions[0].content；此处兼容 slots 与 v1 的 '*' 字段
            pageInfo.text = rev?.content ?? rev?.slots?.main?.content ?? rev?.slots?.main?.['*'] ?? '';
        },
        api,
    );
}

/**
 * 抓取文件页面的直链 URL（写入 page.fileUrl）。
 * @param pages 目标页面
 */
export async function* fetchFileUrl(pages: PageInfo[], api = API): AsyncGenerator<PageInfo> {
    yield* fetchPagePropBatch(
        pages,
        { action: 'query', prop: 'imageinfo', iiprop: 'url' },
        (pageInfo, apiPage) => {
            const info = apiPage.imageinfo?.[0];
            if (info?.url) {
                pageInfo.fileUrl = info.url;
            }
        },
        api,
    );
}

/**
 * 抓取页面所属分类（写入 page.categories），支持分页续查。
 * @param pages 目标页面
 */
export async function fetchPageCategories(pages: PageInfo[], api = API): Promise<void> {
    if (pages.length === 0) {
        return;
    }
    const batchSize = 50;
    for (let i = 0; i < pages.length; i += batchSize) {
        const batch = pages.slice(i, i + batchSize);
        const titles = batch.map(p => p.title).join('|');
        const titleMap = new Map(batch.map(p => [p.title, p]));
        let continueParams: MWApiParams | null = null;
        do {
            const params: MWApiParams = { action: 'query', titles, prop: 'categories', cllimit: 'max' };
            if (continueParams) {
                Object.assign(params, continueParams);
            }
            const response = (await api.get(params)) as {
                query?: {
                    pages?: ApiQueryPage[];
                    normalized?: Array<{ from: string; to: string }>;
                };
                continue?: Record<string, string>;
            };
            const query = response.query;
            if (!query?.pages) {
                break;
            }
            if (query.normalized) {
                for (const norm of query.normalized) {
                    const original = titleMap.get(norm.from);
                    if (original) {
                        titleMap.set(norm.to, original);
                    }
                }
            }
            for (const apiPage of query.pages) {
                const pageInfo = titleMap.get(apiPage.title);
                if (!pageInfo) {
                    continue;
                }
                pageInfo.ns = apiPage.ns;
                const newCategories = (apiPage.categories ?? []).map(cat => cat.title);
                if (pageInfo.categories.length) {
                    pageInfo.categories.push(...newCategories);
                } else {
                    pageInfo.categories = newCategories;
                }
            }
            continueParams = response.continue ?? null;
        } while (continueParams !== null);
    }
}
