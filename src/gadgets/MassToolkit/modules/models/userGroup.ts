import { getSiteInfo } from '../api/mwApi';
import { state } from './state';

/**
 * 站点用户组。
 */
export interface UserGroup {
    /** 用户组名称 */
    name: string;
    /** 用户组拥有的权限列表 */
    rights: string[];
}

/** 获取已缓存的用户组列表 */
export function getAllUserGroups(): UserGroup[] | undefined {
    return state.cache.userGroups;
}

/**
 * 汇总所有用户组拥有的权限集合。
 * @param userGroups 用户组列表
 */
export function getAllUserRights(userGroups: UserGroup[]): Set<string> {
    return new Set(userGroups.flatMap(group => group.rights));
}

let userGroupPromise: Promise<UserGroup[]> | undefined;

/**
 * 异步加载站点全部用户组（带缓存，幂等）。
 */
export async function fetchAllUserGroups(): Promise<UserGroup[]> {
    if (state.cache.userGroups !== undefined) {
        return getAllUserGroups()!;
    }
    if (userGroupPromise !== undefined) {
        return userGroupPromise;
    }
    userGroupPromise = (async () => {
        try {
            const siteInfo = await getSiteInfo();
            state.cache.userGroups = siteInfo.query.usergroups;
            state.cache.allUserRights = getAllUserRights(state.cache.userGroups);
            return state.cache.userGroups;
        } finally {
            userGroupPromise = undefined;
        }
    })();
    return userGroupPromise;
}
