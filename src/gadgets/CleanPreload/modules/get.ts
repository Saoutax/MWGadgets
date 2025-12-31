const { wgPageName } = mw.config.get();

export async function getContent() {
    const {
        query: {
            pages: [
                {
                    revisions: [{ content }],
                },
            ],
        },
    } = await new mw.Api().get({
        action: "query",
        titles: wgPageName,
        prop: "revisions",
        rvprop: "content",
        formatversion: 2,
    });

    return content;
}
