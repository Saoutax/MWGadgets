/** 把任意抛出的值转成可读文案。 */
const toErrorMessage = (error: unknown): string => {
    return error instanceof Error ? error.message : String(error);
};

/** 已知错误码 → 中文说明。 */
const ERROR_MESSAGES: Record<string, string> = {
    badtoken: '登录令牌已失效，请刷新页面后重试。',
    assertuserfailed: '当前登录状态已失效（可能已在别处退出登录），请刷新页面后重新登录。',
    ratelimited: '操作过于频繁，已被限流，请稍后再试。',
    protectedpage: '目标讨论页已被保护，您没有权限编辑。',
    permissiondenied: '权限不足，无法编辑该讨论页。',
    blocked: '您当前的账号或 IP 已被封禁，无法编辑。',
    spamdetected: '内容被防滥用过滤器判定为垃圾信息，已被拒绝。',
    editconflict: '发生编辑冲突，请刷新页面后重试。',
    articleexists: '目标页面已存在，无法新建。',
    readonly: '本站当前处于只读状态，暂时无法编辑。',
};

/** 从 API 的 reject 载荷里取出服务端给的 info 文案。 */
const extractInfo = (result: unknown): string => {
    if (typeof result !== 'object' || result === null) {
        return '';
    }
    const payload = result as { error?: { info?: string }; errors?: { info?: string }[] };
    return payload.error?.info ?? payload.errors?.[0]?.info ?? '';
};

/**
 * 把 API 错误码翻译成中文说明。
 * @param code 错误码，来自 postWithToken 的多参 reject 的第一个参数
 * @param result reject 的第二个参数，形如 { error: { code, info } }
 */
const describeSendError = (code: string, result?: unknown): string => {
    const info = extractInfo(result);
    // 用 hasOwn 而非直接下标：code 来自服务端，直接取值会命中原型链上的键（如 toString）
    const known = Object.hasOwn(ERROR_MESSAGES, code) ? ERROR_MESSAGES[code] : undefined;
    if (known) {
        return info ? `${known}（${info}）` : known;
    }
    if (code.startsWith('abusefilter')) {
        return `被防滥用过滤器阻止（${code}）${info ? `：${info}` : ''}`;
    }
    if (code === 'unknown_error') {
        return `发送失败，且未收到服务端错误详情。${info ? `（${info}）` : ''}`;
    }
    return `发送失败（${code}）${info ? `：${info}` : ''}`;
};

export { describeSendError, toErrorMessage };
