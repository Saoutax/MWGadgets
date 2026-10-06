/**
 * 扫描 src/gadgets/，解析出每个小工具的入口文件。
 */

import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { GADGETS_ROOT } from './constants';
import type { Gadget, ResolvedGadgets } from './types';

/** 入口扩展名，按优先级排列；同名多种扩展名并存时取靠前的那个。 */
const ENTRY_EXTENSIONS = ['ts', 'tsx', 'js', 'jsx', 'scss', 'css'] as const;

/**
 * 列出 src/gadgets/ 下的所有小工具目录名。
 *
 * 排序后返回：readdir 的顺序没有保证，不排序的话每次构建的日志顺序都不一样。
 *
 * @returns 按字典序排好的目录名
 */
const listGadgetNames = async (): Promise<string[]> => {
    const entries = await readdir(GADGETS_ROOT, { withFileTypes: true });
    return entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name)
        .sort();
};

/**
 * 扫描 src/gadgets/ 并解析出各自的入口文件。
 *
 * 不因为某个目录缺入口就中断：把全部问题一次收集齐再返回，免得改完一个才发现下一个。
 *
 * @returns 解析成功的小工具，以及全部入口问题
 */
export const resolveGadgets = async (): Promise<ResolvedGadgets> => {
    const gadgets: Gadget[] = [];
    const problems: string[] = [];

    for (const name of await listGadgetNames()) {
        const dir = join(GADGETS_ROOT, name);
        const files = new Set(await readdir(dir));
        // 不能依赖 readdir 的返回顺序：一旦某目录同时存在 X.ts 与 X.scss，
        // 就会随文件系统顺序挑中不同文件，构建结果变得不确定。
        const entry = ENTRY_EXTENSIONS.map(ext => `${name}.${ext}`).find(candidate => files.has(candidate));

        if (!entry) {
            problems.push(`${name}: 未找到入口文件，期望 ${name}.{${ENTRY_EXTENSIONS.join('|')}}`);
            continue;
        }

        gadgets.push({
            name,
            entry: join(dir, entry),
            kind: /\.(css|scss)$/.test(entry) ? 'style' : 'script',
        });
    }

    return { gadgets, problems };
};
