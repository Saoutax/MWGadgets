/** MediaWiki API 返回的页面正文及其编辑时间戳。 */
interface PageData {
    /** 页面当前版本的维基文本。 */
    content: string;
    /** 开始读取页面时的时间，用于提交时检测并发编辑。 */
    starttimestamp: string | null;
    /** 读取到的修订版本时间，用作编辑基线。 */
    timestamp: string | null;
}

type MWPage = { title: string } & ({ revisions: [{ timestamp: string; content: string }] } | { missing: true });

type MWTitle = { title: string };

type MWPageResponse = {
    query: {
        pages: [MWPage & { starttimestamp: string }];
    };
};

type MWRedirectResponse = {
    query: {
        pages: [{ redirects?: MWTitle[] }];
    };
    continue?: {
        rdcontinue?: string;
    };
};

type MWBacklinkResponse = {
    query: {
        backlinks: MWTitle[];
    };
    continue?: {
        blcontinue?: string;
    };
};

type MWEditResponse = {
    edit: {
        newtimestamp?: string;
    };
};

/** 会话中的页面工作副本，同时保留最近一次服务器版本作为比较基线。 */
interface PageState extends PageData {
    /** 页面加载或成功保存时的正文，用于判断当前内容是否有未提交修改。 */
    originalContent: string;
}

/** 一条 wikilink 在页面正文中的解析结果。 */
interface WikiLink {
    /** 链接显示给读者的文字。 */
    displayText: string;
    /** 链接在当前正文中的结束索引（不包含该索引）。 */
    end: number;
    /** 链接在当前正文中的开始索引。 */
    start: number;
    /** 去掉 fragment 并规范化后的目标标题。 */
    target: string;
    /** 链接中原始的目标文本，可能包含 fragment。 */
    title: string;
}

/** 面板展示所需的前文、当前链接和后文。 */
type ContextParts = [before: string, link: string, after: string];

/** 将原始标题转换为规范标题；无法解析时返回 `null`。 */
type TitleNormalizer = (title: string) => string | null;

/** 一次页面操作及其撤销所需的前态快照。 */
interface ActionRecord {
    /** 操作前的完整页面内容，用于可靠恢复而非反向计算。 */
    contentBefore: string;
    /** 操作类型；`skip` 不修改正文，但仍可被撤销。 */
    kind: 'remove' | 'replace' | 'skip';
    /** 操作发生时的链接位置和显示信息。 */
    link: WikiLink;
    /** 操作所属的页面标题。 */
    pageTitle: string;
    /** 用于该页面编辑摘要的操作说明。 */
    summary: string;
}

/** 目标页面及其相关链入页面的查询结果。 */
interface BacklinkResult {
    /** 目标页及其重定向别名，供链接扫描匹配。 */
    aliases: string[];
    /** 需要加载和处理的链入页面标题。 */
    pages: string[];
}

/** 面板按钮对会话操作的回调集合。 */
interface PanelCallbacks {
    /** 关闭当前会话。 */
    close: () => void;
    /** 跳过当前链接并前进。 */
    next: () => void;
    /** 撤销最近一次操作。 */
    previous: () => void;
    /** 移除当前链接。 */
    remove: () => void;
    /** 提交当前页面修改。 */
    submit: () => void;
}

/** 会话控制面板向状态机提供的最小 UI 接口。 */
interface Panel {
    /** 从页面中移除面板及其事件入口。 */
    destroy: () => void;
    /** 展示当前链接的上下文。 */
    setContext: (parts: ContextParts) => void;
    /** 更新面板状态提示。 */
    setInfo: (text: string) => void;
    /** 更新当前处理页面标题。 */
    setPage: (title: string) => void;
    /** 切换 active、busy 或 done 状态。 */
    setState: (state: 'active' | 'busy' | 'done') => void;
    /** 根据是否存在脏页启用或禁用提交按钮。 */
    setSubmitEnabled: (enabled: boolean) => void;
    /** 显示已创建但默认隐藏的面板。 */
    show: () => void;
}

/** 会话向 UI 推送状态变化的回调集合。 */
interface SessionView {
    /** 更新是否正在进行异步操作。 */
    onBusy: (busy: boolean) => void;
    /** 更新是否存在未提交修改。 */
    onChanges: (hasChanges: boolean) => void;
    /** 更新当前页面、正文和链接上下文。 */
    onContext: (title: string, content: string, link: WikiLink) => void;
    /** 通知 UI 会话已完成或停止。 */
    onDone: () => void;
    /** 更新加载、提交等状态文字。 */
    onInfo: (text: string) => void;
}

/** 页面队列中的一项，记录页面标题及下一次扫描位置。 */
interface QueuedPage {
    /** 页面内下次查找链接的起始字符位置。 */
    startIndex: number;
    /** 待处理页面标题。 */
    title: string;
}

export type {
    ActionRecord,
    BacklinkResult,
    ContextParts,
    PageData,
    PageState,
    Panel,
    PanelCallbacks,
    QueuedPage,
    SessionView,
    TitleNormalizer,
    WikiLink,
    MWBacklinkResponse,
    MWEditResponse,
    MWPage,
    MWPageResponse,
    MWRedirectResponse,
    MWTitle,
};
