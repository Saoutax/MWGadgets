import { api } from './api';
import { EDIT_TAGS } from './constants';
import { describeSendError } from './errors';
import type { SendResult } from './types';

/** 发送参数。 */
interface SendParams {
    /** 目标用户（不含 User talk: 前缀） */
    targetUser: string;
    /** 最终提交正文，已含 subst 改写与签名（由 buildSubmitText 生成） */
    text: string;
    /** 编辑摘要 */
    summary: string;
}

/**
 * 向目标用户讨论页追加一个新章节。
 *
 * 用 .then(onOk, onError) 而非 try/catch：postWithToken 以 (code, result, ...) 多参 reject，
 * await 只会拿到第一个参数（错误码），会丢掉 result.error.info。
 *
 * 失败不抛错，返回判别联合以便上层「重试」。
 * @param params 发送参数
 */
const sendEdit = async (params: SendParams): Promise<SendResult> => {
    return api
        .postWithToken('csrf', {
            action: 'edit',
            assertuser: mw.config.get('wgUserName') ?? '',
            formatversion: 2,
            title: `User talk:${params.targetUser}`,
            section: 'new',
            // 必须显式传空串，而不是省略该参数：省略会让 MediaWiki 退回
            // 「用 summary 充当章节标题」的兜底行为，而提醒模板正文自带标题，会重复生成。
            sectiontitle: '',
            text: params.text,
            summary: params.summary,
            tags: EDIT_TAGS,
        })
        .then((): SendResult => ({ ok: true }))
        .catch((code: string, result?: unknown): SendResult => {
            console.warn('[UserMessages] 发送失败', code, result);
            return { ok: false, code, detail: describeSendError(code, result) };
        });
};

export { type SendParams, sendEdit };
