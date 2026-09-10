import type { ActionRecord } from '../types';

/**
 * 根据一次会话中的操作记录生成 MediaWiki 编辑摘要。
 *
 * `session.submit` 按页面筛选记录后调用此函数；跳过动作只影响导航，不应出现在实际编辑摘要中。
 *
 * @param targetPage 本次会话正在修复的目标页面标题
 * @param actions 当前页面产生的操作记录
 * @returns 可直接传给 MediaWiki 编辑 API 的编辑摘要
 */
const buildEditSummary = (targetPage: string, actions: readonly ActionRecord[]): string => {
    // skip 是可撤销的导航动作，不代表页面内容发生了编辑。
    const meaningfulActions = actions.filter(action => action.kind !== 'skip');
    if (meaningfulActions.length > 0 && meaningfulActions.every(action => action.kind === 'remove')) {
        // 全部是移除链接时使用更简短的摘要，避免把每次相同操作重复列出。
        return `DisamAssist：移除链接：[[${targetPage}]]`;
    }

    // 同一页面可能多次执行相同替换；去重可让摘要保持可读且有意义。
    const changes = [...new Set(meaningfulActions.map(action => action.summary))];
    return `DisamAssist：[[${targetPage}]] → ${changes.join('；')}`;
};

export { buildEditSummary };
