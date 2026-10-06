/**
 * 构建单个小工具：产物写进暂存目录，构建期完全不碰 dist/。
 */

import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { build } from 'vite';
import { createLogCapture } from './logger';
import type { Artifact, BuildResult, CapturedLog, Gadget } from './types';
import { createConfig } from './viteConfig';

/**
 * 取出本次构建新写出的产物。
 *
 * 用构建前后的目录差集，而不是 build() 的返回值：两种入口模式返回的结构不同，
 * 差集对两者一视同仁，也省得去猜 Vite 的返回类型。
 *
 * @param outDir 产物目录
 * @param before 构建前已有的文件名
 * @returns 本次写出的产物及其大小
 */
const collectArtifacts = async (outDir: string, before: Set<string>): Promise<Artifact[]> => {
    const written = (await readdir(outDir)).filter(file => !before.has(file)).sort();

    return Promise.all(written.map(async name => ({ name, bytes: (await stat(join(outDir, name))).size })));
};

/**
 * 构建单个小工具。
 *
 * 失败不抛出而是记进返回值：某一个挂掉不该中断其余构建，一次跑完能看到全部失败项。
 *
 * @param gadget 待构建的小工具
 * @param outDir 产物目录（构建期是暂存目录）
 * @returns 构建结果
 */
export const buildGadget = async (gadget: Gadget, outDir: string): Promise<BuildResult> => {
    const before = new Set(await readdir(outDir));
    const log: CapturedLog[] = [];
    const startedAt = performance.now();

    try {
        await build(createConfig(gadget, outDir, createLogCapture(log)));

        const artifacts = await collectArtifacts(outDir, before);
        if (artifacts.length === 0) {
            throw new Error('构建结束，但没有任何产物写出');
        }

        return { gadget, ok: true, artifacts, durationMs: performance.now() - startedAt, log };
    } catch (error) {
        return { gadget, ok: false, error, artifacts: [], durationMs: performance.now() - startedAt, log };
    }
};
