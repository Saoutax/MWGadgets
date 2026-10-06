/**
 * 构建脚本用到的路径与参数。
 *
 * 集中放在这里，是因为几个目录的相对位置本身就有约束 —— 见 STAGING_DIR 上的说明，
 * 散落到各模块里很容易改错其中一处。
 */

import { resolve } from 'node:path';

const ROOT = process.cwd();
export const SRC_DIR = resolve(ROOT, 'src');
export const GADGETS_ROOT = resolve(ROOT, 'src/gadgets');
export const DIST_DIR = resolve(ROOT, 'dist');

/**
 * 构建暂存目录。
 *
 * 必须与 dist/ 同级同深度：sourcemap 的 sources 是按 map 文件所在目录算相对路径的，
 * 暂存目录一旦换个深度，产物字节就和已提交的 dist/ 对不上，CI 的同步校验会失败。
 */
export const STAGING_DIR = resolve(ROOT, '.dist-staging');

/** 换入 dist/ 时的临时备份，交换成功后立刻删除，只在交换被中断时残留。 */
export const BACKUP_DIR = resolve(ROOT, '.dist-backup');

/** 本地安装的 TypeScript 编译器入口，用 node 直接跑，不经 shell / npx。 */
export const TSC_BIN = resolve(ROOT, 'node_modules/typescript/bin/tsc');

/**
 * 删除目录时用的参数。
 *
 * maxRetries / retryDelay 是 Node 自带的退避重试，专门覆盖 Windows 上删除被句柄或
 * 杀软短暂占住的情况；不写的话一次 EPERM 就会让构建失败。
 */
export const RM_OPTIONS = { recursive: true, force: true, maxRetries: 5, retryDelay: 100 } as const;

/** rename 的重试次数与间隔，理由同上：Windows 上目录改名同样可能被短暂占住。 */
export const RENAME_ATTEMPTS = 5;
export const RENAME_RETRY_DELAY_MS = 100;
