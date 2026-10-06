/** 申请表格里已知的三个字段名。 */
type RequestKey = 'title' | 'reason' | 'detail';

/** 单个讨论串里解析出的提删申请。 */
interface RequestInfo {
    /** 讨论串锚点 id；标题上找不到 id 时为 `undefined` */
    sectionTitle: string | undefined;
    /** 讨论串标题元素 */
    header: Element;
    /** 页面标题 */
    title?: string;
    /** 申请理由 */
    reason?: string;
    /** 详细原因 */
    detail?: string;
}

/** 已通过标题与锚点校验、可执行删除的申请。 */
interface DeletableRequestInfo extends RequestInfo {
    title: string;
    sectionTitle: string;
}

export type { DeletableRequestInfo, RequestInfo, RequestKey };
