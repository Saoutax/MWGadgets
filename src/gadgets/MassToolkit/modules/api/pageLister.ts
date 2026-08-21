import { InputType, type UserInputOption } from '../components/inputDialog';
import { getNamespaces } from '../models/namespace';
import { flatMap } from '../utils/result';
import { API } from './mwApi';
import { PageSelector, type SelectorConfig } from './pageSelector';

/** 列表/属性查询参数 */
export type QueryArguments = Record<string, string | number | boolean>;

/** query 列表型响应 */
export interface ApiQueryListResponse<T = { title: string }> {
    continue?: Record<string, string>;
    query?: { [listName: string]: T[] | { results: T[] } };
    batchcomplete?: string;
}

/** query 属性型响应（formatversion 2 下 query.pages 为数组） */
export interface ApiQueryPropResponse<Prop extends string, T> {
    continue?: Record<string, string>;
    query?: {
        pages: Array<{ pageid?: number; ns: number; title: string } & { [K in Prop]: T[] }>;
    };
}

/**
 * 页面列表器基类：产生页面项迭代。
 */
export abstract class PageLister<T = { title: string }> extends PageSelector {
    static readonly inputs: UserInputOption[] = [];

    api = API;

    protected constructor(protected readonly args: QueryArguments) {
        super();
    }

    /** 生成页面项的异步迭代器 */
    abstract getNext(): AsyncGenerator<T>;

    /**
     * 一次性拉取全部结果。
     */
    async fetchAll(): Promise<T[]> {
        const all: T[] = [];
        for await (const page of this.getNext()) {
            all.push(page);
        }
        return all;
    }
}

/**
 * 基于 list 查询的列表器（categorymembers、allpages、embeddedin、backlinks、querypage、logevents 等）。
 */
export abstract class ApiListQuery<T = { title: string }> extends PageLister<T> {
    /**
     * @param listName list 名称
     * @param prefix 参数前缀
     * @param params 查询参数
     */
    protected constructor(
        public readonly listName: string,
        public readonly prefix: string,
        params: QueryArguments = {},
    ) {
        super(params);
    }

    async *getNext(): AsyncGenerator<T> {
        const requestParams: QueryArguments = {
            action: 'query',
            list: this.listName,
            [`${this.prefix}limit`]: 'max',
            ...this.args,
        };
        let limit = parseInt((this.args.limit as string) ?? '', 10);
        let continueParams: QueryArguments = {};
        do {
            const response = (await this.api.get({ ...requestParams, ...continueParams })) as ApiQueryListResponse<T>;
            const raw = response.query?.[this.listName];
            const items: T[] = Array.isArray(raw) ? raw : (raw?.results ?? []);
            for (const item of items) {
                yield item;
                if (!Number.isNaN(limit)) {
                    limit -= 1;
                    if (limit <= 0) {
                        break;
                    }
                }
            }
            // 达到上限时跳出 do/while，避免继续拉取整批 500 项
            if (!Number.isNaN(limit) && limit <= 0) {
                break;
            }
            continueParams = response.continue ?? {};
        } while (Object.keys(continueParams).length > 0);
    }
}

/**
 * 基于 prop 查询的列表器（links、images、fileusage 等）。
 */
export abstract class ApiPropQuery<Prop extends string, T = { title: string }> extends PageLister<T> {
    /**
     * @param prop prop 名称
     * @param prefix 参数前缀
     * @param params 查询参数
     */
    protected constructor(
        public readonly prop: Prop,
        public readonly prefix: string,
        protected readonly params: QueryArguments = {},
    ) {
        super(params);
    }

    async *getNext(): AsyncGenerator<T> {
        const requestParams: QueryArguments = {
            action: 'query',
            prop: this.prop,
            [`${this.prefix}limit`]: 'max',
            ...this.args,
        };
        let continueParams: QueryArguments = {};
        do {
            const response = (await this.api.get({ ...requestParams, ...continueParams })) as ApiQueryPropResponse<
                Prop,
                T
            >;
            // formatversion 2 下 query.pages 为数组，单标题查询取第一项
            const firstPage = response.query?.pages?.[0];
            const results = firstPage?.[this.prop];
            if (Array.isArray(results)) {
                for (const result of results) {
                    yield result;
                }
            }
            continueParams = response.continue ?? {};
        } while (Object.keys(continueParams).length > 0);
    }
}

/** 某分类下的全部页面 */
export class CategoryMembersQuery extends ApiListQuery {
    static readonly description = '分类下的全部页面';
    static override readonly inputs: UserInputOption[] = [
        { key: 'cmtitle', label: '分类：', type: InputType.PAGE, defaultValue: 'Category:' },
    ];

    constructor(args: QueryArguments) {
        super('categorymembers', 'cm', args);
    }

    getDescription(): string {
        return `分类 ${this.args.cmtitle} 的全部成员`;
    }
}

/** 某名字空间下的全部页面 */
export class AllPagesQuery extends ApiListQuery {
    static readonly description = '名字空间下的全部页面';
    static override readonly inputs: UserInputOption[] = [
        {
            key: 'apnamespace',
            label: '名字空间名称或编号（仅允许一个）',
            type: InputType.NAMESPACE,
            defaultValue: 'Main',
            validator: nsString => {
                const result = getNamespaces().toNamespace(String(nsString));
                return flatMap(result, ns => ns.number.toString());
            },
        },
    ];

    constructor(args: QueryArguments) {
        super('allpages', 'ap', args);
    }

    getDescription(): string {
        const result = getNamespaces().toNamespace(this.args.apnamespace as string);
        const label = result.ok ? result.value.toString() : (this.args.apnamespace as string);
        return `名字空间 ${label} 下的全部页面`;
    }
}

/** 嵌入（引用）了某页面的全部页面 */
export class EmbeddedInQuery extends ApiListQuery {
    static readonly description = '引用某页面的全部页面';
    static override readonly inputs: UserInputOption[] = [
        {
            key: 'eititle',
            label: '被引用页面名称：',
            type: InputType.PAGE,
            defaultValue: 'Template:',
            help: '通常是模板被引用，不过也可以列出引用了某页面的页面',
        },
    ];

    constructor(args: QueryArguments) {
        super('embeddedin', 'ei', args);
    }

    getDescription(): string {
        return `引用了 ${this.args.eititle} 的全部页面`;
    }
}

/** 链接到某页面的全部页面 */
export class BacklinksQuery extends ApiListQuery {
    static readonly description = '链接到某页面的全部页面';
    static override readonly inputs: UserInputOption[] = [
        { key: 'bltitle', label: '被链接页面名称：', type: InputType.PAGE },
    ];

    constructor(args: QueryArguments) {
        super('backlinks', 'bl', args);
    }

    getDescription(): string {
        return `链接到 ${this.args.bltitle} 的全部页面`;
    }
}

/** 某页面上的全部链接 */
export class PageLinksQuery extends ApiPropQuery<'links'> {
    static readonly description = '某页面上的全部链接';
    static override readonly inputs: UserInputOption[] = [{ key: 'titles', label: '标题：', type: InputType.PAGE }];

    constructor(args: QueryArguments) {
        super('links', 'pl', args);
    }

    getDescription(): string {
        return `${this.args.titles} 上的全部链接`;
    }
}

/** 使用某文件的所有页面 */
export class FileUsageQuery extends ApiPropQuery<'fileusage'> {
    static readonly description = '使用某文件的全部页面';
    static override readonly inputs: UserInputOption[] = [
        { key: 'titles', label: '文件：', type: InputType.PAGE, defaultValue: 'File:' },
    ];

    constructor(args: QueryArguments) {
        super('fileusage', 'fu', args);
    }

    getDescription(): string {
        return `使用了 ${this.args.titles} 的全部页面`;
    }
}

/** 某页面上的全部文件 */
export class PageImagesQuery extends ApiPropQuery<'images'> {
    static readonly description = '某页面上的全部文件';
    static override readonly inputs: UserInputOption[] = [{ key: 'titles', label: '页面：', type: InputType.PAGE }];

    constructor(args: QueryArguments) {
        super('images', 'im', args);
    }

    getDescription(): string {
        return `${this.args.titles} 使用的全部文件`;
    }
}

const QUERY_PAGE_OPTIONS =
    'Ancientpages, BrokenRedirects, Deadendpages, DisambiguationPageLinks, DisambiguationPages, DoubleRedirects, Fewestrevisions, GadgetUsage, GloballyWantedFiles, ListDuplicatedFiles, Listredirects, Lonelypages, Longpages, MediaStatistics, MostGloballyLinkedFiles, Mostcategories, Mostimages, Mostinterwikis, Mostlinked, Mostlinkedcategories, Mostlinkedtemplates, Mostrevisions, OrphanedTalkPages, Shortpages, SoftRedirectPageLinks, SoftRedirectPages, Uncategorizedcategories, Uncategorizedimages, Uncategorizedpages, Uncategorizedtemplates, Unusedcategories, Unusedimages, Unusedtemplates, Unwatchedpages, Wantedcategories, Wantedfiles, Wantedpages, Wantedtemplates, Withoutinterwiki';

/** 特殊页上列出的全部页面（如 Special:Wantedpages） */
export class QueryPageQuery extends ApiListQuery {
    static readonly description = '特殊页上列出的全部页面';
    static override readonly inputs: UserInputOption[] = [
        {
            key: 'qppage',
            label: '特殊页名称（区分大小写）：',
            type: InputType.SELECT,
            options: QUERY_PAGE_OPTIONS.split(',').map(p => ({ data: p.trim(), label: p.trim() })),
        },
        {
            key: 'limit',
            label: '页面数量上限',
            type: InputType.TEXT,
            defaultValue: '不限',
            help: '最多抓取的页面数量。输入非数字值表示不设上限，否则必须是正整数。',
        },
    ];

    constructor(args: QueryArguments) {
        super('querypage', 'qp', args);
    }

    getDescription(): string {
        return `Special:${this.args.qppage} 上列出的全部页面`;
    }
}

const LOG_EVENT_TYPES = [
    'block',
    'create',
    'delete',
    'import',
    'move',
    'newusers',
    'patrol',
    'protect',
    'rights',
    'upload',
];

/** 日志条目涉及的页面 */
export class LogEventsQuery extends ApiListQuery {
    static readonly description = '日志条目涉及的页面';
    static override readonly inputs: UserInputOption[] = [
        {
            key: 'letype',
            label: '日志类型：',
            type: InputType.SELECT,
            options: LOG_EVENT_TYPES.map(value => ({ data: value, label: value })),
            optional: true,
            help: '留空表示全部日志类型。此处仅列出常用类型，也可输入任意合法类型。',
        },
        {
            key: 'leaction',
            label: '日志动作：',
            type: InputType.TEXT,
            optional: true,
            help: '用更具体的动作覆盖日志类型。例如 delete/delete 表示删除日志中的页面删除，delete/restore 表示恢复删除。',
        },
        { key: 'lestart', label: '时间之前：', type: InputType.TIMESTAMP, optional: true },
        { key: 'leend', label: '时间之后：', type: InputType.TIMESTAMP, optional: true },
        {
            key: 'leuser',
            label: '仅保留指定用户的日志条目：',
            type: InputType.TEXT,
            optional: true,
        },
    ];

    constructor(args: QueryArguments) {
        super('logevents', 'le', args);
    }

    getDescription(): string {
        const entries = Object.entries(this.args)
            .filter(([, value]) => value)
            .map(([key, value]) => `(${key}, ${value})`)
            .join(', ');
        return `符合条件 ${entries} 的日志条目`;
    }
}

/** 列表器类配置 */
export interface QueryConstructor extends SelectorConfig<QueryArguments> {
    new (args: QueryArguments): PageLister;
}

/** 全部可用列表器 */
export const allQueryLister: QueryConstructor[] = [
    CategoryMembersQuery,
    AllPagesQuery,
    EmbeddedInQuery,
    BacklinksQuery,
    PageLinksQuery,
    FileUsageQuery,
    PageImagesQuery,
    QueryPageQuery,
    LogEventsQuery,
];
