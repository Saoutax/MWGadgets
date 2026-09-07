import type { ActionRecord } from './types';

const buildEditSummary = (targetPage: string, actions: readonly ActionRecord[]): string => {
    const meaningfulActions = actions.filter(action => action.kind !== 'skip');
    if (meaningfulActions.length > 0 && meaningfulActions.every(action => action.kind === 'remove')) {
        return `DisamAssist：移除链接：[[${targetPage}]]`;
    }

    const changes = [...new Set(meaningfulActions.map(action => action.summary))];
    return `DisamAssist：[[${targetPage}]] → ${changes.join('；')}`;
};

export { buildEditSummary };
