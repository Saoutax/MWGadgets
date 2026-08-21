import type { NamespaceList } from './namespace';
import type { PageInfo } from './page';
import type { UserGroup } from './userGroup';

/**
 * 运行期缓存：名字空间、用户权限、用户组、页面信息等。
 */
class Cache {
    /** 名字空间列表（延迟加载） */
    namespaces?: NamespaceList;
    /** 当前用户权限 */
    userRights?: string[];
    /** 站点全部用户组 */
    userGroups?: UserGroup[];
    /** 站点所有用户组权限的并集 */
    allUserRights: Set<string> = new Set();
    /** 已抓取的页面信息缓存（按标题） */
    cachedPageInfo: Record<string, PageInfo> = {};
}

/**
 * 全局配置（持久化到 localStorage）。
 */
export class Config {
    /** 调试模式 */
    debug = false;
    /** bot 用户名占位，summary 中的 `$bot` 会被替换 */
    summaryBot = 'MassToolkit 机器人';
    /** 读操作节流间隔（秒） */
    readThrottle = 0.2;
    /** 写操作节流间隔（秒） */
    writeThrottle = 1;
    /** 是否在 bot 运行时保持屏幕唤醒 */
    wakeLockEnabled = true;
}

/**
 * 全局共享状态。
 */
class State {
    cache = new Cache();
    config = new Config();
}

/** 全局单例状态 */
export const state = new State();

/** 是否处于调试模式 */
export function isDebugMode(): boolean {
    return state.config.debug;
}

/** 是否启用屏幕唤醒锁 */
export function isWakeLockEnabled(): boolean {
    return state.config.wakeLockEnabled;
}

/**
 * 缓存页面信息。
 * @param pageInfo 页面信息
 */
export function cachePageInfo(pageInfo: PageInfo): void {
    state.cache.cachedPageInfo[pageInfo.title] = pageInfo;
}

/**
 * 获取缓存的页面信息。
 * @param title 页面标题
 */
export function getCachedPageInfo(title: string): PageInfo | undefined {
    return state.cache.cachedPageInfo[title];
}

/** 清空页面信息缓存（每次启动新 bot 前调用） */
export function clearCachedPageInfo(): void {
    state.cache.cachedPageInfo = {};
}
