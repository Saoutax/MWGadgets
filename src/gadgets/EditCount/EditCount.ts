(() => {
    const { wgUserEditCount } = mw.config.get(['wgUserEditCount']);

    if (!wgUserEditCount) {
        return;
    }

    mw.loader.addStyleTag(
        `#pt-mycontris > a::after, .menu__item--userContributions > span > span::after {content:" (${wgUserEditCount ?? 0})"}`,
    );
})();
