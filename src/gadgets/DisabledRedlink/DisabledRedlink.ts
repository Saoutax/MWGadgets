(() => {
    document.querySelectorAll<HTMLAnchorElement>('a[href*="action=edit"][href*="redlink=1"]').forEach(anchor => {
        const url = new URL(anchor.href);
        url.searchParams.delete('action');
        url.searchParams.delete('redlink');
        anchor.href = url.toString();
    });
})();
