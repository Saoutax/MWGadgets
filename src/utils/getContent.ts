const { wgPageName } = mw.config.get();

/**
 * 获取页面内容
 *
 * @param titles 页面标题，默认为当前页面
 * @returns 页面内容
 */
const getContent = async (titles = wgPageName) => {
    const {
        query: {
            pages: [
                {
                    revisions: [{ content }],
                },
            ],
        },
    } = await new mw.Api().get({
        action: 'query',
        titles,
        prop: 'revisions',
        rvprop: 'content',
        formatversion: 2,
    });
    return content;
};

export { getContent };
