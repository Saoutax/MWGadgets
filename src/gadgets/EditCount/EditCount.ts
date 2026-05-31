(() => {
    const { wgUserEditCount } = mw.config.get();

    if (wgUserEditCount == null) {
        return;
    }

    mw.loader.addStyleTag(
        `#pt-mycontris > a::after, .menu__item--userContributions > span > span::after {content:" (${wgUserEditCount ?? 0})"}`,
    );
})();
