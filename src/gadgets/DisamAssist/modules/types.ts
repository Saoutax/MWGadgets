interface PageData {
    content: string;
    starttimestamp: string | null;
    timestamp: string | null;
}

interface PageState extends PageData {
    originalContent: string;
}

interface WikiLink {
    displayText: string;
    end: number;
    start: number;
    target: string;
    title: string;
}

type ContextParts = [before: string, link: string, after: string];

type TitleNormalizer = (title: string) => string | null;

interface ActionRecord {
    contentBefore: string;
    kind: 'remove' | 'replace' | 'skip';
    link: WikiLink;
    pageTitle: string;
    summary: string;
}

interface BacklinkResult {
    aliases: string[];
    pages: string[];
}

interface PanelCallbacks {
    close: () => void;
    next: () => void;
    previous: () => void;
    remove: () => void;
    submit: () => void;
}

interface Panel {
    destroy: () => void;
    setContext: (parts: ContextParts) => void;
    setInfo: (text: string) => void;
    setPage: (title: string) => void;
    setState: (state: 'active' | 'busy' | 'done') => void;
    setSubmitEnabled: (enabled: boolean) => void;
    show: () => void;
}

interface SessionView {
    onBusy: (busy: boolean) => void;
    onChanges: (hasChanges: boolean) => void;
    onContext: (title: string, content: string, link: WikiLink) => void;
    onDone: () => void;
    onInfo: (text: string) => void;
}

interface QueuedPage {
    startIndex: number;
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
};
