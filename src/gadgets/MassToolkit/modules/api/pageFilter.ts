import { InputType, type UserInputOption } from '../components/inputDialog';
import { Namespace, parseNamespaceString } from '../models/namespace';
import { PageInfo } from '../models/page';
import { RegexHelper, type RegexConfigOptions } from '../utils/regexHelper';
import { flatMap, unwrap } from '../utils/result';
import { PageSelector, type SelectorConfig } from './pageSelector';

/** 过滤器参数 */
export interface FilterArguments extends RegexConfigOptions {
    namespace?: string;
    excludeMatches?: boolean;
    searchText?: string;
}

/** 过滤所需的页面附加信息类型 */
export enum RequiredPageInfo {
    TEXT,
    CATEGORY,
}

/**
 * 页面过滤器基类：按条件筛选页面流。
 */
export abstract class PageFilter extends PageSelector {
    /** 过滤所需的附加信息（文本/分类） */
    readonly requiredInfo: RequiredPageInfo[] = [];
    static readonly validator?: (args: FilterArguments) => boolean;

    protected readonly args: FilterArguments;

    /**
     * @param args 过滤器参数
     */
    constructor(args: FilterArguments) {
        super();
        this.args = args;
    }

    /**
     * 过滤输入流：仅产出通过 test 的页面。
     * @param input 页面输入流
     */
    async *filter(input: AsyncIterable<PageInfo>): AsyncGenerator<PageInfo> {
        for await (const page of input) {
            if (this.test(page)) {
                yield page;
            }
        }
    }

    /** 判定单个页面是否满足条件 */
    public abstract test(page: PageInfo): boolean;

    /**
     * 文本匹配（支持正则），按 excludeMatches 取反。
     * @param text 待匹配文本
     */
    protected matchText(text: string): boolean {
        let match: boolean;
        if (this.args.useRegex) {
            match = new RegExp(this.args.searchText!, this.args.regexFlags).test(text);
        } else {
            match = text.includes(this.args.searchText!);
        }
        return match !== this.args.excludeMatches;
    }
}

/** 按名字空间过滤 */
export class NamespaceFilter extends PageFilter {
    static readonly description = '名字空间';
    static override readonly inputs: UserInputOption[] = [
        {
            key: 'namespace',
            label: '名字空间：',
            type: InputType.NAMESPACES,
            validator: nsString => {
                const result = parseNamespaceString(String(nsString));
                return flatMap(result, namespaces => namespaces.map(ns => ns.name).join('|'));
            },
        },
        { key: 'excludeMatches', label: '改为排除这些名字空间', type: InputType.BOOLEAN },
    ];

    private readonly namespaces: Namespace[];

    constructor(args: FilterArguments) {
        super(args);
        this.namespaces = unwrap(parseNamespaceString(args.namespace!));
    }

    test(page: PageInfo): boolean {
        const namespaceMatch = this.namespaces.some(ns => ns.number === page.ns);
        return namespaceMatch !== this.args.excludeMatches;
    }

    getDescription(): string {
        const nsList = this.namespaces.map(ns => ns.toString()).join(', ');
        return `${this.args.excludeMatches ? '排除' : '仅保留'}名字空间 ${nsList} 中的页面`;
    }
}

/** 按页面标题过滤 */
export class TitleFilter extends PageFilter {
    static readonly description = '页面标题';
    static override readonly inputs: UserInputOption[] = [
        { key: 'searchText', label: '标题匹配：', type: InputType.TEXT },
        ...RegexHelper.createRegexInputGroup('useRegex', 'regexFlags', { defaultFlags: 'm' }),
        { key: 'excludeMatches', label: '改为排除标题匹配的页面', type: InputType.BOOLEAN },
    ];
    static override readonly validator = (args: FilterArguments) => RegexHelper.regexValidator(args, args.searchText!);

    test(page: PageInfo): boolean {
        return this.matchText(page.title);
    }

    getDescription(): string {
        return `${this.args.excludeMatches ? '排除' : '仅保留'}标题匹配${this.args.useRegex ? '（正则）' : ''} ${this.args.searchText} 的页面`;
    }
}

/** 按页面 wikitext 内容过滤 */
export class ContentFilter extends PageFilter {
    static readonly description = '页面 wikitext 内容';
    static override readonly inputs: UserInputOption[] = [
        { key: 'searchText', label: '内容匹配：', type: InputType.TEXT },
        ...RegexHelper.createRegexInputGroup('useRegex', 'regexFlags', { defaultFlags: 'm' }),
        { key: 'excludeMatches', label: '改为排除内容匹配的页面', type: InputType.BOOLEAN },
    ];
    readonly requiredInfo: RequiredPageInfo[] = [RequiredPageInfo.TEXT];
    static override readonly validator = (args: FilterArguments) =>
        RegexHelper.regexValidator(args, args.searchText ?? '');

    test(page: PageInfo): boolean {
        return this.matchText(page.text!);
    }

    getDescription(): string {
        return `${this.args.excludeMatches ? '排除' : '仅保留'}wikitext 内容匹配${this.args.useRegex ? '（正则）' : ''} ${this.args.searchText} 的页面`;
    }
}

/** 按所属分类过滤 */
export class InCategoryFilter extends PageFilter {
    static readonly description = '页面分类';
    static override readonly inputs: UserInputOption[] = [
        { key: 'searchText', label: '属于分类：', type: InputType.PAGE, defaultValue: 'Category:' },
        { key: 'excludeMatches', label: '改为排除属于该分类的页面', type: InputType.BOOLEAN },
    ];
    override readonly requiredInfo: RequiredPageInfo[] = [RequiredPageInfo.CATEGORY];

    test(page: PageInfo): boolean {
        return page.categories.includes(this.args.searchText!) !== this.args.excludeMatches;
    }

    getDescription(): string {
        return `${this.args.excludeMatches ? '排除' : '仅保留'}属于分类 ${this.args.searchText} 的页面`;
    }
}

/** 过滤器类配置 */
export interface FilterConstructor extends SelectorConfig<FilterArguments> {
    new (args: FilterArguments): PageFilter;
}

/** 全部可用过滤器 */
export const allPageFilters: FilterConstructor[] = [NamespaceFilter, TitleFilter, ContentFilter, InCategoryFilter];
