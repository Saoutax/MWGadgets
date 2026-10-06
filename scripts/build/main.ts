/**
 * 构建流程的编排：类型检查 → 解析入口 → 逐个构建 → 交换产物。
 */

import { execFileSync } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import { buildGadget } from './buildGadget';
import { RM_OPTIONS, STAGING_DIR, TSC_BIN } from './constants';
import { resolveGadgets } from './discover';
import { publish } from './publish';
import { reportFailures, reportGadget, reportSummary } from './report';
import type { BuildResult } from './types';

/**
 * 跑一遍类型检查。
 *
 * 直接调用本地安装的 tsc 而不是 npx：少一层解析，typescript 缺失时立刻失败，
 * 不会去联网找一个同名的包来跑。--noEmit 不能删 —— tsconfig.base.json 里有
 * declaration + composite，去掉会往 src/ 旁边输出 .js / .d.ts。
 *
 * @returns 通过为 true；失败时 tsc 自己已经把错误打到 stderr 上了
 */
const runTypeCheck = (): boolean => {
    console.log('类型检查…');
    try {
        execFileSync(process.execPath, [TSC_BIN, '--build', '--noEmit'], { stdio: 'inherit' });
        return true;
    } catch {
        return false;
    }
};

/**
 * 编排整个构建流程。
 *
 * 失败一律早返回：类型检查、入口解析、小工具构建三道关卡中的任何一道没过，
 * 都停在原地并保持 dist/ 不变。
 */
export const main = async (): Promise<void> => {
    if (!runTypeCheck()) {
        console.error('类型检查未通过，dist/ 未被修改。');
        process.exitCode = 1;
        return;
    }

    const { gadgets, problems } = await resolveGadgets();
    if (problems.length > 0) {
        console.error('入口文件有误，dist/ 未被修改：');
        for (const problem of problems) {
            console.error(`  ${problem}`);
        }
        process.exitCode = 1;
        return;
    }

    console.log(`构建 ${gadgets.length} 个小工具…`);
    await rm(STAGING_DIR, RM_OPTIONS);
    await mkdir(STAGING_DIR, { recursive: true });

    const results: BuildResult[] = [];
    for (const gadget of gadgets) {
        const result = await buildGadget(gadget, STAGING_DIR);
        results.push(result);
        reportGadget(result);
    }

    const failures = results.filter(result => !result.ok);
    if (failures.length > 0) {
        reportFailures(failures);
        // 暂存目录里是半成品，清掉；dist/ 从头到尾没被碰过。
        await rm(STAGING_DIR, RM_OPTIONS);
        console.error('\n构建失败，dist/ 未被修改。');
        process.exitCode = 1;
        return;
    }

    await publish();
    reportSummary(results);
};
