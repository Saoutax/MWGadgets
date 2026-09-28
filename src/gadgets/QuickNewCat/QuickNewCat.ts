import { render, h } from 'preact';
import { UI } from './components/UI';
import './styles/QuickNewCat.scss';

(() => {
    const { wgNamespaceNumber, wgRevisionId, wgArticleId, wgIsArticle } = mw.config.get();

    if (wgNamespaceNumber !== 14 || !(wgRevisionId === 0 && wgArticleId === 0) || !wgIsArticle) {
        return;
    }

    const target = document.querySelector('#mw-content-text') ?? document.querySelector('#bodyContent');

    if (!target) {
        return;
    }

    // ooui-react 不自带样式，DOM 与类名对齐原版 OOUI，需先加载 RL 模块取得主题样式
    void mw.loader.using(['oojs-ui'], () => {
        const container = document.createElement('div');
        target.prepend(container);
        render(h(UI, {}), container);
    });
})();
