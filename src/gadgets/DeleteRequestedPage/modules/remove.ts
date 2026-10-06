import type { DeletableRequestInfo } from './types';

/**
 * 已成功删除的标题，键含 `cm:` 前缀以区分本地与共享站的同名页面。
 * DiscussionTools 重绘会重建按钮，靠它把「已删除」态续上，避免同一页面被删第二次。
 */
const deletedTitles = new Set<string>();

/** 本地站 API，首次需要时创建。 */
let localApi: mw.Api | undefined;

/** 共享站 API，首次需要时创建。 */
let commonsApi: mw.ForeignApi | undefined;

/**
 * 取对应站点的 API 实例。
 *
 * @param isCommons 是否在共享站执行
 * @returns 对应站点的 API 实例
 */
const getDeleteApi = (isCommons: boolean): mw.Api => {
    if (!isCommons) {
        localApi ||= new mw.Api();
        return localApi;
    }
    commonsApi ||= new mw.ForeignApi('https://commons.moegirl.org.cn/api.php');
    return commonsApi;
};

/**
 * 描述任意错误值。
 *
 * @param error 任意错误值
 * @returns 可读的错误描述
 */
const describeError = (error: unknown): string => {
    if (error instanceof Error) {
        return error.message;
    }
    return typeof error === 'string' ? error : JSON.stringify(error);
};

/**
 * 生成链回当前讨论串的永久链接 wikitext，写法与 [[Gadget:SectionPermanentLink]] 一致。
 * 摘要写在共享站上时要给内链补上指向主站的跨维基前缀 `zhmoe:`，否则会渲染成红链。
 *
 * @param sectionTitle 讨论串锚点 id
 * @param isCommons 摘要是否写在共享站上
 * @returns `[[Special:PermanentLink/…|讨论版申请]]`
 */
const buildBoardLink = (sectionTitle: string, isCommons: boolean): string =>
    `[[${isCommons ? 'zhmoe:' : ''}Special:PermanentLink/${mw.config.get('wgRevisionId')}#${mw.util.escapeIdForLink(sectionTitle)}|讨论版申请]]`;

/**
 * 弹窗确认并执行一次提删。
 *
 * @param info 解析出的申请信息
 * @returns 是否真的执行了删除
 */
const runDeletion = async (info: DeletableRequestInfo): Promise<boolean> => {
    const isCommons = info.title.startsWith('cm:');
    const target = isCommons ? info.title.slice('cm:'.length) : info.title;
    const reasonText = [info.reason, info.detail].filter(value => typeof value === 'string' && value !== '').join('：');
    // 弹窗里展示纯文本理由；实际写进删除日志的摘要额外前置一条链回本讨论串的内链。
    const summary = `${buildBoardLink(info.sectionTitle, isCommons)}：${reasonText}`;
    const siteLabel = isCommons ? '共享站' : '';
    const confirmed = await oouiDialog.confirm(
        wgULS(
            `确定要删除${siteLabel}页面 <b>${oouiDialog.sanitize(target)}</b> 吗？<br>删除理由：${oouiDialog.sanitize(reasonText)}`,
            `確定要刪除${siteLabel}頁面 <b>${oouiDialog.sanitize(target)}</b> 嗎？<br>刪除理由：${oouiDialog.sanitize(reasonText)}`,
        ),
        {
            title: wgULS('执行提删', '執行提刪'),
        },
    );
    if (!confirmed) {
        return false;
    }
    await getDeleteApi(isCommons)
        .postWithToken('csrf', {
            action: 'delete',
            assertuser: mw.config.get('wgUserName') ?? undefined,
            formatversion: 2,
            title: target,
            reason: summary,
            tags: 'Automation tool',
        })
        .catch((code: string, result?: unknown) => {
            // postWithToken 的失败回调带 (code, result) 两个参数，用 await/catch 只能拿到 code，
            // 这里补回 result.error.info 以便给出可读的错误提示。
            const detail = (result as { error?: { info?: string } } | undefined)?.error?.info;
            throw new Error(detail ? `${code}：${detail}` : `${code}`);
        });
    deletedTitles.add(info.title);
    mw.notify($('<span>').text(wgULS(`已删除【${target}】`, `已刪除【${target}】`)), {
        title: wgULS('删除成功', '刪除成功'),
        type: 'success',
        tag: 'lr-drp',
    });
    return true;
};

/**
 * 把按钮置为「已删除」态：摘掉点击响应并置灰。
 *
 * @param $button 按钮
 */
const markDeleted = ($button: JQuery): void => {
    $button.off('click').css({ color: '#72777d', cursor: 'default' }).text(wgULS('已删除', '已刪除'));
};

export { deletedTitles, describeError, markDeleted, runDeletion };
