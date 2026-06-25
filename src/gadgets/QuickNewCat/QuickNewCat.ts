import { render, h } from 'preact';
import { UI } from './components/UI';
import './styles/QuickNewCat.scss';

(() => {
    const { wgNamespaceNumber, wgRevisionId, wgArticleId, wgIsArticle } = mw.config.get();

    if (wgNamespaceNumber !== 14 || !(wgRevisionId === 0 && wgArticleId === 0) || !wgIsArticle) {
        return;
    }

    const target = document.querySelector('#mw-content-text') ?? document.querySelector('#bodyContent');

    if (target) {
        const container = document.createElement('div');
        target.prepend(container);
        render(h(UI, {}), container);
    }
})();
