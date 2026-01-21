function restoreImg($el: JQuery<HTMLElement>, src: string, style: string, isLink: boolean) {
    const img = new Image();
    img.onload = function () {
        const $img = $(this as HTMLImageElement);

        if (style) {
            $img.attr("style", style);
        }

        if (isLink) {
            const link = $("<a>")
                .attr({
                    href: src,
                    target: $el.attr("target") || "_blank",
                    rel: $el.attr("rel") || "noopener noreferrer",
                    class: $el.attr("class") || "",
                    title: $el.attr("title") || "",
                })
                .append($img);
            $el.replaceWith(link);
        } else {
            $el.replaceWith($img);
        }
    };
    img.src = src;
    img.alt = src;
}

export { restoreImg };
