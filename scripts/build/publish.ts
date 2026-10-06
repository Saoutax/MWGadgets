/**
 * 把暂存目录整体换入 dist/，换不进去就回滚。
 */

import { rename, rm, stat } from 'node:fs/promises';
import { BACKUP_DIR, DIST_DIR, RENAME_ATTEMPTS, RENAME_RETRY_DELAY_MS, RM_OPTIONS, STAGING_DIR } from './constants';

/**
 * 判断路径是否存在。
 *
 * @param path 待检查的路径
 * @returns 存在为 true
 */
const pathExists = async (path: string): Promise<boolean> => {
    try {
        await stat(path);
        return true;
    } catch {
        return false;
    }
};

/**
 * 判断 rename 的失败是不是「过一会儿就好」的那种。
 *
 * @param error 捕获到的错误
 * @returns 值得重试为 true
 */
const isTransientRenameError = (error: unknown): boolean => {
    const code = (error as NodeJS.ErrnoException | undefined)?.code;
    return code === 'EPERM' || code === 'EBUSY' || code === 'EACCES' || code === 'ENOTEMPTY';
};

/**
 * 带重试的 rename。
 *
 * dist/ 的交换全靠它，而这一步在 Windows 上实测会偶发 EPERM —— 目录刚被写了一堆文件，
 * 句柄或杀软还没松手。产物本身没问题，退避重试几次就过去了，不该让构建跟着抽风。
 *
 * @param from 源路径
 * @param to 目标路径
 */
const renameWithRetry = async (from: string, to: string): Promise<void> => {
    for (let attempt = 1; ; attempt++) {
        try {
            await rename(from, to);
            return;
        } catch (error) {
            if (attempt >= RENAME_ATTEMPTS || !isTransientRenameError(error)) {
                throw error;
            }
            await new Promise(resolve => setTimeout(resolve, RENAME_RETRY_DELAY_MS * attempt));
        }
    }
};

/**
 * 交换失败时的回滚：把备份换回 dist/。
 *
 * 回滚本身再失败就如实说出来 —— 此时 dist/ 是空的，完整产物只可能在 BACKUP_DIR，
 * 不吭声会让下一个人把它当成一次普通的构建失败。
 */
const rollback = async (): Promise<void> => {
    if (!(await pathExists(BACKUP_DIR))) {
        return;
    }
    try {
        await renameWithRetry(BACKUP_DIR, DIST_DIR);
    } catch {
        console.error(`回滚失败：交换前的产物仍在 ${BACKUP_DIR}，本次产物在 ${STAGING_DIR}。`);
    }
};

/**
 * 把暂存目录整体换入 dist/。
 *
 * 到这一步为止 dist/ 一直原封未动，所以任何一个构建失败都不会弄坏仓库里已提交的产物。
 * 交换用 rename 而不是「删掉再拷」：rename 在同卷上是元操作，也比 rm -rf 更不容易被
 * 占着句柄的编辑器或杀软挡住；万一换不进去，上一步留下的备份还能换回来。
 */
export const publish = async (): Promise<void> => {
    // 上次交换被中断的话 dist/ 可能正缺着，此时备份就是唯一的完整产物，先恢复。
    if (!(await pathExists(DIST_DIR)) && (await pathExists(BACKUP_DIR))) {
        await renameWithRetry(BACKUP_DIR, DIST_DIR);
    }

    await rm(BACKUP_DIR, RM_OPTIONS);

    if (await pathExists(DIST_DIR)) {
        await renameWithRetry(DIST_DIR, BACKUP_DIR);
    }

    try {
        await renameWithRetry(STAGING_DIR, DIST_DIR);
    } catch (error) {
        await rollback();
        throw error;
    }

    // 交换已经成功，备份没用了；删不掉也不影响结果。
    await rm(BACKUP_DIR, RM_OPTIONS);
};
