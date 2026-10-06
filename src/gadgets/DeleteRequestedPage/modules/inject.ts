import { parseAll } from './parse';
import { deletedTitles, describeError, markDeleted, runDeletion } from './remove';
import type { DeletableRequestInfo } from './types';

/**
 * 遍历全页讨论串，在「请求删除」段落的标题旁注入「删除」按钮。
 *
 * 已标记 [[Template:MarkAsResolved]] 或已存档的段落由 `parseAll` 过滤掉；
 * 注入位置、去重标记与源仓库保持一致，DiscussionTools 重绘后由入口再次调用。
 */
const injectButtons = (): void => {
    for (const info of parseAll(['saveNotice', 'MarkAsResolved'])) {
        const { header, sectionTitle, title } = info;
        // 「请求恢复」「请求移动」等其它申请可能复用同样的「标签：值」格式，只认「请求删除」段落。
        if (
            typeof title !== 'string' ||
            title === '' ||
            typeof sectionTitle !== 'string' ||
            !sectionTitle.startsWith('请求删除')
        ) {
            continue;
        }
        const $header = $(header);
        if ($header.find('.lr-drp-link')[0]) {
            continue;
        }
        const $bracket = $header.find('.mw-editsection-bracket').first();
        if (!$bracket.length) {
            continue;
        }
        const button = $('<a>').attr('href', 'javascript:void(0);').prop('draggable', false).addClass('lr-drp-link');
        if (deletedTitles.has(title)) {
            markDeleted(button);
        } else {
            const request: DeletableRequestInfo = { ...info, title, sectionTitle };
            button.text(wgULS('删除', '刪除')).on('click', async event => {
                event.preventDefault();
                event.stopPropagation();
                if (button.hasClass('lr-drp-running')) {
                    return;
                }
                button.addClass('lr-drp-running');
                try {
                    if (await runDeletion(request)) {
                        markDeleted(button);
                    }
                } catch (error) {
                    console.error('[DeleteRequestedPage] 删除失败:', error);
                    await oouiDialog.alert(
                        wgULS(
                            `删除【${oouiDialog.sanitize(title)}】失败：<br>${oouiDialog.sanitize(describeError(error))}`,
                            `刪除【${oouiDialog.sanitize(title)}】失敗：<br>${oouiDialog.sanitize(describeError(error))}`,
                        ),
                        {
                            title: wgULS('删除失败', '刪除失敗'),
                        },
                    );
                } finally {
                    button.removeClass('lr-drp-running');
                }
            });
        }
        $bracket.after('<span class="mw-editsection-divider"> | </span>').after(button);
    }
};

export { injectButtons };
