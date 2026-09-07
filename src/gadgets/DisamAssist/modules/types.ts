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

interface ActionRecord {
    contentBefore: string;
    kind: 'remove' | 'replace' | 'skip';
    link: WikiLink;
    pageTitle: string;
    summary: string;
}

export type { ActionRecord, ContextParts, PageData, PageState, WikiLink };
