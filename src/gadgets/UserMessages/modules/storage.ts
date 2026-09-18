import { STORAGE_KEY } from './constants';

/** 需要跨会话记住的状态。 */
export interface PersistedState {
    /** 上次选中的模板 title */
    templateTitle: string;
    /** 上次的编辑摘要 */
    editSummary: string;
}

/** 兜底状态。 */
const DEFAULT_STATE: PersistedState = { templateTitle: '', editSummary: '' };

/**
 * 读取本地状态。逐字段校验类型，任何非法值都回落到默认值。
 */
export function loadPersisted(): PersistedState {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) {
            return { ...DEFAULT_STATE };
        }
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        return {
            templateTitle: typeof parsed.templateTitle === 'string' ? parsed.templateTitle : '',
            editSummary: typeof parsed.editSummary === 'string' ? parsed.editSummary : '',
        };
    } catch (error) {
        console.warn('[UserMessages] 读取本地状态失败，使用默认值', error);
        return { ...DEFAULT_STATE };
    }
}

/**
 * 合并写入本地状态。写入失败（如隐私模式）静默忽略，不影响主流程。
 * @param patch 需要更新的字段
 */
export function savePersisted(patch: Partial<PersistedState>): void {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...loadPersisted(), ...patch }));
    } catch (error) {
        console.warn('[UserMessages] 写入本地状态失败', error);
    }
}
