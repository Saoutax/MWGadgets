const { wgPageName } = mw.config.get();

const {
    query: {
        pages: [
            {
                revisions: [{ content }],
            },
        ],
    },
} = await (async () => {
    return new mw.Api().get({
        action: "query",
        titles: wgPageName,
        prop: "revisions",
        rvprop: "content",
        formatversion: 2,
    });
})();

export default content;
