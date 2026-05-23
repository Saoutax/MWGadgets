import { getContent } from '@/utils';
import { extractImgStyle } from './modules/extractImgStyle';
import { restoreImg } from './modules/restoreImg';

(async () => {
    const { wgNamespaceNumber } = mw.config.get();
    const $brokenImages = $('.moe-img-error, .moe-img-blocked');

    if (wgNamespaceNumber === -1 || $brokenImages.length === 0) {
        return;
    }

    await getContent().then(content => {
        $brokenImages.each((index, element) => {
            const $this = $(element);
            const isLink = $this.is('a');
            const src = isLink ? $this.attr('href') || '' : $this.attr('data-src-input') || '';
            const style = extractImgStyle(content, src, index);
            restoreImg($this, src, style, isLink);
        });
    });
})();
