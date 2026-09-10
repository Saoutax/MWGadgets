/**
 * MediaWiki 提供的繁简转换函数。
 *
 * DisamAssist 不自行选择语言变体，而是把简体和繁体文案交给页面运行环境转换。
 *
 * @param hans 简体中文文案
 * @param hant 繁体中文文案
 * @returns 当前用户语言变体对应的文案
 */
declare function wgULS(hans: string, hant: string): string;

/** DisamAssist 面板、按钮和通知共用的本地化文案。 */
const msg = {
    autoSubmit: wgULS('检测到 30 秒无新操作，将自动提交。', '檢測到 30 秒無新操作，將自動提交。'),
    close: wgULS('结束', '結束'),
    completed: wgULS('全部处理完成', '全部處理完成'),
    context: wgULS('当前链接上下文', '目前連結上下文'),
    editFailed: wgULS('保存失败', '保存失敗'),
    editing: wgULS('正在提交更改…', '正在提交更改…'),
    loading: wgULS('正在加载页面…', '正在載入頁面…'),
    loadingBacklinks: wgULS('正在获取链入页面…', '正在取得鏈入頁面…'),
    noBacklinks: wgULS('没有找到链入页面。', '沒有找到鏈入頁面。'),
    noChanges: wgULS('没有待提交的更改。', '沒有待提交的更改。'),
    processing: wgULS('处理中', '處理中'),
    portletMain: wgULS('开始消歧义', '開始消歧義'),
    portletPage: wgULS('消歧义链入页面', '消歧義鏈入頁面'),
    portletSuffix: wgULS('消歧义（无后缀）', '消歧義（無後綴）'),
    remove: wgULS('移除链接', '移除連結'),
    submit: wgULS('提交', '提交'),
    next: wgULS('下一个', '下一個'),
    previous: wgULS('上一个', '上一個'),
    skipped: wgULS('已跳过', '已跳過'),
    submitted: wgULS('已提交', '已提交'),
    target: wgULS('页面', '頁面'),
    unsavedChanges: wgULS('有未提交的更改，确定要结束吗？', '有未提交的更改，確定要結束嗎？'),
};

export { msg };
