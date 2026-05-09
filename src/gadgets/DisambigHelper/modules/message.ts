const { wgUserLanguage } = mw.config.get();
const msg = {
    loading: '加载中...',
    loadingFailed: '( ﾟ∀。)加载失败',
    editing: '修改中...',
    edited: '修改成功！正在刷新页面...',
    editFailed: '( ﾟ∀。)修改失败',
    disambig: '消歧义',
};
if (wgUserLanguage === 'zh-hant') {
    msg.loading = '加載中...';
    msg.loadingFailed = '( ﾟ∀。)加載失敗';
    msg.editing = '修改中...';
    msg.edited = '修改成功！正在刷新頁面...';
    msg.editFailed = '( ﾟ∀。)修改失敗';
    msg.disambig = '消歧義';
}
export { msg };
