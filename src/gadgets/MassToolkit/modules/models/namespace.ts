import { getSiteInfo } from '../api/mwApi';
import type { Result } from '../utils/result';
import { state } from './state';

/**
 * 名字空间。
 */
export class Namespace {
    /**
     * @param name 名字空间名称（Main 名字空间显示为 "Main"）
     * @param number 名字空间编号
     */
    constructor(
        public readonly name: string,
        public readonly number: number,
    ) {}

    /** 人类可读表示 */
    toString(): string {
        return `${this.number} (${this.name})`;
    }
}

/**
 * 名字空间列表，支持按名称或编号查找。
 */
export class NamespaceList {
    private readonly index: Record<string, Namespace> = {};

    /**
     * @param namespaces 名字空间数组
     */
    constructor(public readonly namespaces: Namespace[]) {
        for (const namespace of namespaces) {
            this.index[namespace.name.toLowerCase()] = namespace;
            this.index[namespace.number.toString()] = namespace;
        }
    }

    /**
     * 将名称或编号解析为名字空间。
     * @param input 名字空间名称或编号
     */
    toNamespace(input: string | number): Result<Namespace> {
        const key = String(input).toLowerCase();
        const result = this.index[key];
        if (result) {
            return { ok: true, value: result };
        }
        return { ok: false, error: `"${input}" is not a valid namespace` };
    }
}

let namespacesPromise: Promise<NamespaceList> | null = null;

/**
 * 获取已加载的名字空间列表（未加载前调用会抛错，请先 getAllNamespacesAsync）。
 */
export function getNamespaces(): NamespaceList {
    if (!state.cache.namespaces) {
        throw new Error('namespaces not loaded; call getAllNamespacesAsync() first');
    }
    return state.cache.namespaces;
}

/**
 * 解析以 `|` 分隔的名字空间字符串（如 `Category|Template`）。
 * @param nsString 名字空间字符串
 */
export function parseNamespaceString(nsString: string): Result<Namespace[]> {
    const namespaces = getNamespaces();
    const result: Namespace[] = [];
    const errors: string[] = [];
    for (const ns of nsString.split('|')) {
        const res = namespaces.toNamespace(ns);
        if (res.ok) {
            result.push(res.value);
        } else {
            errors.push(res.error);
        }
    }
    if (errors.length === 0) {
        return { ok: true, value: result };
    }
    return { ok: false, error: errors.join('\n') };
}

/**
 * 异步加载站点全部名字空间（带缓存，幂等）。
 */
export async function getAllNamespacesAsync(): Promise<NamespaceList> {
    if (state.cache.namespaces) {
        return getNamespaces();
    }
    if (namespacesPromise !== null) {
        return namespacesPromise;
    }
    namespacesPromise = (async () => {
        try {
            const siteInfo = await getSiteInfo();
            // formatversion 2 下 query.namespaces 为数组；名称字段 v2 为 name、v1 为 '*'，故防御性回退
            const namespaces = siteInfo.query.namespaces.map(ns => {
                const nsName = ns.id === 0 ? 'Main' : (ns.name ?? ns.canonical ?? ns['*']);
                return new Namespace(nsName, ns.id);
            });
            state.cache.namespaces = new NamespaceList(namespaces);
            return state.cache.namespaces;
        } finally {
            // 失败时清空 in-flight 标记以允许重试；成功路径由 state.cache.namespaces 早返回兜底
            namespacesPromise = null;
        }
    })();
    return namespacesPromise;
}
