const sanitizeUrl = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) {
        return '';
    }

    try {
        const parsed = new URL(trimmed, window.location.origin);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            return trimmed;
        }
    } catch {
        return '';
    }

    return '';
};

const restoreImg = ($el: JQuery<HTMLElement>, src: string, style: string, isLink: boolean) => {
    const safeSrc = sanitizeUrl(src);
    const img = new Image();
    img.onload = function () {
        const $img = $(this as HTMLImageElement);

        if (style) {
            $img.attr('style', style);
        }

        if (isLink) {
            const link = $('<a>')
                .attr({
                    href: safeSrc || '#',
                    target: $el.attr('target') || '_blank',
                    rel: $el.attr('rel') || 'noopener noreferrer',
                    class: $el.attr('class') || '',
                    title: $el.attr('title') || '',
                })
                .append($img);
            $el.replaceWith(link);
        } else {
            $el.replaceWith($img);
        }
    };
    img.src = safeSrc;
    img.alt = safeSrc;
};

export { restoreImg };
