function collectAttrs(selectors: Array<[string, string]>): Set<string> {
    const result = new Set<string>();

    selectors.forEach(([selector, attr]) =>
        document.querySelectorAll<HTMLElement>(selector).forEach(el => {
            const val = el.getAttribute(attr);
            if (val) {
                result.add(val);
            }
        }),
    );

    return result;
}

export function domURL(): Set<string> {
    return collectAttrs([
        [".moe-img-error[data-src-input]", "data-src-input"],
        [".moe-img-blocked[href]", "href"],
    ]);
}