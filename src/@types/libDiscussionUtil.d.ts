/**
 * `ext.gadget.libDiscussionUtil` 提供的讨论版工具集。
 */
interface LibDiscussionUtil {
    /**
     * 取出页面上的所有讨论串标题。
     *
     * @param filterClasses 正文含这些 class 的段落会被跳过
     * @returns 标题元素与对应锚点 id；锚点 id 缺失时为 `undefined`
     */
    getDiscussionHeader(filterClasses?: string[]): { self: JQuery; sectionTitle: string | undefined }[];

    /**
     * 注册内容变化（DiscussionTools 重绘等）后的回调。
     *
     * 回调不带参数，需自行重新扫描整页，且必须可重复执行。
     *
     * @param callback 内容变化后执行的回调
     */
    onContentChange(callback: () => void): unknown;
}

interface Window {
    libDiscussionUtil: LibDiscussionUtil;
}
