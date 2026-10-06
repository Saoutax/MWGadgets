/**
 * 构建入口：把 src/gadgets/ 下每个子目录构建成一份独立的 IIFE 产物。
 *
 * 产物一律先写进暂存目录，等全部小工具都构建成功后才整体换入 dist/。dist/ 是被 git
 * 跟踪并提交的（CI 会校验它与 src/ 同步），构建失败时绝不能让它停在半成品状态。
 */

import { main } from './main';

try {
    await main();
} catch (error) {
    console.error('构建中断，dist/ 未被修改。');
    console.error(error);
    process.exitCode = 1;
}
