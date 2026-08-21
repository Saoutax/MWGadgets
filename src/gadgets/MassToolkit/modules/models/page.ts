/**
 * MediaWiki query API 返回的页面基本属性。
 */
export class PageProps {
    /**
     * @param title 页面标题
     * @param pageid 页面 ID
     * @param ns 名字空间编号
     */
    constructor(
        public readonly title: string,
        public pageid?: number,
        public ns?: number,
    ) {}
}

/**
 * 带扩展信息的页面（文本、分类、文件直链等，按需填充）。
 */
export class PageInfo extends PageProps {
    /** 页面 wikitext 内容 */
    text?: string;
    /** 页面所属分类标题列表 */
    categories: string[] = [];
    /** 文件页面对应的直链地址（批量下载用） */
    fileUrl?: string;

    /**
     * @param props 页面基本属性
     */
    constructor(props: PageProps) {
        super(props.title, props.pageid, props.ns);
    }

    /**
     * 去掉名字空间前缀后的标题（如 `File:Example.png` → `Example.png`）。
     */
    titleWithoutNs(): string {
        if (Number.isInteger(this.ns) && this.ns !== 0) {
            return this.title.split(':').slice(1).join(':');
        }
        return this.title;
    }
}
