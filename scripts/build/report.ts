/**
 * 构建过程的全部输出。
 *
 * 只用纯文本，不用 emoji 或 ✓ / ✗ 之类的状态符号：成功与失败靠文字本身区分。
 */

import type { BuildResult } from './types';

/**
 * 把字节数格式化成便于阅读的字符串。
 *
 * @param bytes 字节数
 * @returns 例如 `12.4 kB`
 */
const formatBytes = (bytes: number): string => `${(bytes / 1024).toFixed(1)} kB`;

/**
 * 把毫秒格式化成便于阅读的字符串。
 *
 * @param ms 毫秒数
 * @returns 例如 `0.42s`
 */
const formatDuration = (ms: number): string => `${(ms / 1000).toFixed(2)}s`;

/**
 * 描述一个未知的抛出值。
 *
 * @param error 捕获到的错误
 * @returns 可直接打印的文本
 */
const describeError = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/**
 * 去掉 ANSI 转义序列。
 *
 * Vite 报错是带颜色的，同一条错误出现在抛出的错误里和出现在日志里时各带一套转义码，
 * 直接比对会判成两条。比对时脱掉颜色，打印时留着。
 *
 * @param text 原始文本
 * @returns 去掉转义序列的文本
 */
// eslint-disable-next-line no-control-regex -- ANSI 转义序列本身就是控制字符，正则必须匹配它
const stripAnsi = (text: string): string => text.replace(/\u001b\[[0-9;]*[A-Za-z]/g, '');

/**
 * 取某个失败项的完整输出。
 *
 * 抛出的错误和 Vite 自己打的日志都要看：Vite 的 logger 有时只说一句 "Build failed in
 * 162ms"，真正的原因在抛出的错误里；反过来，编译类错误往往先在日志里说清楚，抛出的
 * 只是个包装。两者都留，但已经在抛出的错误里出现过的日志就不再重复。
 *
 * 注意 Vite 自己的错误文案里有可能把同一条错误渲染两遍（一遍带文件名，一遍带堆栈），
 * 那部分在本脚本这里拦不住。
 *
 * @param result 构建失败的结果
 * @returns 可直接打印的文本
 */
const describeFailure = ({ log, error }: BuildResult): string => {
    const thrown = describeError(error);
    const seen = stripAnsi(thrown);
    const captured = log
        .filter(entry => entry.level !== 'info')
        .map(entry => entry.message)
        .filter(message => !seen.includes(stripAnsi(message)));

    return [thrown, ...captured].join('\n');
};

/**
 * 打印单个小工具的构建结果。
 *
 * 成功的多打一行体积，失败的用「失败」二字顶替体积。另外只多打警告：Vite 的进度类
 * 输出没必要占屏幕，但弃用提示之类的警告漏掉会让问题更难查。
 *
 * @param result 构建结果
 */
export const reportGadget = (result: BuildResult): void => {
    const duration = formatDuration(result.durationMs);
    const detail = result.ok
        ? `${formatBytes(result.artifacts.reduce((sum, artifact) => sum + artifact.bytes, 0))}  ${duration}`
        : `失败  ${duration}`;

    console.log(`  ${result.gadget.name}  ${detail}`);

    for (const entry of result.log) {
        if (entry.level === 'warn') {
            console.warn(`      警告: ${entry.message}`);
        }
    }
};

/**
 * 汇总打印失败项。
 *
 * 全局配置坏掉时每个小工具会报同样的错，完全相同的输出折叠成一条，免得刷屏把
 * 真正有用的那行挤掉。
 *
 * @param failures 构建失败的结果
 */
export const reportFailures = (failures: BuildResult[]): void => {
    const groups = new Map<string, string[]>();
    for (const failure of failures) {
        const detail = describeFailure(failure);
        groups.set(detail, [...(groups.get(detail) ?? []), failure.gadget.name]);
    }

    console.error(`\n${failures.length} 个小工具构建失败：`);
    for (const [detail, names] of groups) {
        console.error(`\n${names.join('、')}:`);
        console.error(detail);
    }
};

/**
 * 打印成功汇总。
 *
 * @param results 全部构建结果
 */
export const reportSummary = (results: BuildResult[]): void => {
    const artifacts = results.flatMap(result => result.artifacts);
    const totalBytes = artifacts.reduce((sum, artifact) => sum + artifact.bytes, 0);
    const totalMs = results.reduce((sum, result) => sum + result.durationMs, 0);

    console.log(
        `构建完成：${results.length} 个小工具，${artifacts.length} 个产物，` +
            `${formatBytes(totalBytes)}，用时 ${formatDuration(totalMs)}`,
    );
};
