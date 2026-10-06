/**
 * 把 Vite 的输出收进缓冲区，交给调用方决定何时打印。
 */

import type { Logger } from 'vite';
import type { CapturedLog } from './types';

/**
 * 造一个把 Vite 输出收进缓冲区的 logger。
 *
 * 每个小工具的日志因此不再直接刷屏，改由调用方决定何时打印：成功的只留一行结果，
 * 失败的才展开原始输出。
 *
 * 压不住的只有 rolldown 原生绑定的构建进度（transforming… / rendering chunks… /
 * computing gzip size…）：它是原生代码直接写进程 stdout 的，既不经过 logger，
 * 也绕过 process.stdout.write，连透传 logLevel: 'silent' 都无效 —— 别再试了。
 *
 * @param sink 收集日志的数组
 * @returns Vite 的 Logger 实现
 */
export const createLogCapture = (sink: CapturedLog[]): Logger => {
    const seen = new Set<string>();
    const loggedErrors = new Set<unknown>();

    const logger: Logger = {
        info: message => {
            sink.push({ level: 'info', message });
        },
        warn: message => {
            logger.hasWarned = true;
            sink.push({ level: 'warn', message });
        },
        warnOnce: message => {
            logger.hasWarned = true;
            if (!seen.has(message)) {
                seen.add(message);
                sink.push({ level: 'warn', message });
            }
        },
        error: (message, options) => {
            if (options?.error) {
                loggedErrors.add(options.error);
            }
            sink.push({ level: 'error', message });
        },
        // Vite 靠这个判断某个错误是否已经展示过，从而决定要不要再补一次堆栈。
        hasErrorLogged: error => loggedErrors.has(error),
        hasWarned: false,
        // 输出由本脚本自己组织，不需要 Vite 清屏。
        clearScreen: () => {},
    };

    return logger;
};
