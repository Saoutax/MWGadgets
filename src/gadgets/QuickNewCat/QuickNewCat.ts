import { render } from 'preact';
import { UI } from './components/UI';

(() => {
    const { wgNamespaceNumber, wgRevisionId, wgArticleId, wgIsArticle } = mw.config.get();

    if (wgNamespaceNumber !== 14 || !(wgRevisionId === 0 && wgArticleId === 0) || !wgIsArticle) {
        return;
    }

    const target = document.querySelector('.noarticletext');

    if (target) {
        const container = document.createElement('div');
        target.before(container);
        render(UI, container);
    }
})();
