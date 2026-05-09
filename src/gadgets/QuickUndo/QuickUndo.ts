import { undo } from './modules/undo';

(() => {
    const { wgAction, wgArticleId, wgIsProbablyEditable } = mw.config.get();

    if (wgAction !== 'history' || !wgIsProbablyEditable) {
        return;
    }

    document.querySelectorAll<HTMLAnchorElement>('.mw-history-undo a').forEach(link => {
        if (link.href.endsWith('#ipe://quick-edit/')) {
            return;
        }

        const url = new URL(link.href);
        const undoId = Number(url.searchParams.get('undo'));
        const undoAfter = Number(url.searchParams.get('undoafter'));

        const quickUndo = document.createElement('a');
        quickUndo.href = '#';
        quickUndo.textContent = '快速撤销';
        quickUndo.title = '无需确定并忽略过滤器警告';

        quickUndo.addEventListener('click', e => {
            e.preventDefault();
            undo(wgArticleId, undoId, undoAfter);
        });

        const span = document.createElement('span');
        span.appendChild(quickUndo);
        span.appendChild(document.createTextNode(' | '));

        link.parentElement?.insertBefore(span, link);
    });
})();
