import { state } from './state';

/** 获取当前用户权限列表 */
export function getUserRights(): string[] | undefined {
    return state.cache.userRights;
}

let userRightsPromise: Promise<string[]> | null = null;

/**
 * 异步获取当前用户权限（带缓存，幂等）。
 */
export async function fetchUserRights(): Promise<string[]> {
    const rights = getUserRights();
    if (rights && rights.length > 0) {
        return rights;
    }
    if (userRightsPromise !== null) {
        return userRightsPromise;
    }
    userRightsPromise = (async () => {
        try {
            const rights = await mw.user.getRights();
            state.cache.userRights = rights;
            return rights;
        } finally {
            userRightsPromise = null;
        }
    })();
    return userRightsPromise;
}
