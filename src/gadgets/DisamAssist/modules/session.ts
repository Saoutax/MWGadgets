import { getBacklinkData, getPage, savePage } from './api';
import { config } from './config';
import { msg } from './messages';
import { buildEditSummary } from './summary';
import type { ActionRecord, PageData, PageState, QueuedPage, SessionView, WikiLink } from '../types';
import { findWikiLink, removeWikiLink, replaceWikiLink } from './wiki';

class DisamSession {
    private readonly actions: ActionRecord[] = [];
    private readonly pages = new Map<string, PageState>();
    private currentLink: WikiLink | null = null;
    private currentPageTitle = '';
    private currentTarget = '';
    private pageQueue: QueuedPage[] = [];
    private possibleTargets = new Set<string>();
    private running = false;
    private submitTimer: number | null = null;

    constructor(private readonly view: SessionView) {}

    get isRunning(): boolean {
        return this.running;
    }

    get hasUnsavedChanges(): boolean {
        return [...this.pages.values()].some(page => page.content !== page.originalContent);
    }

    async start(target: string): Promise<void> {
        if (this.running) {
            mw.notify('DisamAssist 已在运行。', { type: 'warn' });
            return;
        }

        this.reset(target);
        this.running = true;
        this.view.onBusy(true);
        this.view.onInfo(msg.loadingBacklinks);

        try {
            const backlinkData = await getBacklinkData(target);
            this.possibleTargets = new Set(backlinkData.aliases);
            this.pageQueue = backlinkData.pages.map(title => ({ startIndex: 0, title }));
            if (this.pageQueue.length === 0) {
                mw.notify(msg.noBacklinks, { type: 'info' });
                this.stop();
                return;
            }
            await this.processNextPage();
        } catch (error) {
            console.error('[DisamAssist] 获取链入页面失败：', error);
            mw.notify('获取链入页面失败。', { type: 'error' });
            this.stop();
        }
    }

    async chooseReplacement(title: string): Promise<void> {
        if (!this.running || !this.currentLink) {
            return;
        }
        const page = this.currentPage();
        const before = page.content;
        page.content = replaceWikiLink(page.content, this.currentLink, title);
        this.record('replace', before, this.currentLink, title);
        await this.advance(this.currentLink.start + 1);
    }

    async chooseRemoval(): Promise<void> {
        if (!this.running || !this.currentLink) {
            return;
        }
        const page = this.currentPage();
        const before = page.content;
        page.content = removeWikiLink(page.content, this.currentLink);
        this.record('remove', before, this.currentLink, msg.remove);
        await this.advance(this.currentLink.start);
    }

    async skip(): Promise<void> {
        if (!this.running || !this.currentLink) {
            return;
        }
        const link = this.currentLink;
        this.record('skip', this.currentPage().content, link, msg.skipped);
        await this.advance(link.end);
    }

    undo(): void {
        const action = this.actions.pop();
        if (!action) {
            return;
        }

        const page = this.pages.get(action.pageTitle);
        if (!page) {
            return;
        }
        page.content = action.contentBefore;

        if (this.currentPageTitle !== action.pageTitle) {
            if (this.currentPageTitle) {
                this.pageQueue.unshift({
                    startIndex: this.currentLink?.start ?? 0,
                    title: this.currentPageTitle,
                });
            }
            this.currentPageTitle = action.pageTitle;
        }
        this.currentLink = action.link;
        this.view.onContext(this.currentPageTitle, page.content, action.link);
        this.view.onBusy(false);
        this.updateInfo();
    }

    async submit(): Promise<void> {
        this.clearSubmitTimer();
        const changedPages = [...this.pages.entries()].filter(([, page]) => page.content !== page.originalContent);
        if (changedPages.length === 0) {
            mw.notify(msg.noChanges, { type: 'info' });
            return;
        }

        this.view.onBusy(true);
        this.view.onInfo(msg.editing);
        let successCount = 0;

        for (const [title, page] of changedPages) {
            const pageActions = this.actions.filter(action => action.pageTitle === title && action.kind !== 'skip');
            try {
                const response = await savePage(title, page.content, page, buildEditSummary(this.currentTarget, pageActions));
                const edit = response.edit;
                page.originalContent = page.content;
                page.timestamp = edit?.newtimestamp ?? page.timestamp;
                this.actions.splice(
                    0,
                    this.actions.length,
                    ...this.actions.filter(action => action.pageTitle !== title),
                );
                successCount++;
            } catch (error) {
                console.error('[DisamAssist] 保存失败：', title, error);
                mw.notify(`${msg.editFailed}「${title}」。`, { type: 'error' });
            }
        }

        if (successCount > 0) {
            mw.notify(`${msg.submitted} ${successCount} 页。`, { type: 'success' });
        }
        this.view.onBusy(false);
        this.updateInfo();
    }

    stop(): void {
        this.running = false;
        this.clearSubmitTimer();
        this.view.onBusy(false);
        this.view.onDone();
    }

    private reset(target: string): void {
        this.actions.length = 0;
        this.pages.clear();
        this.currentLink = null;
        this.currentPageTitle = '';
        this.currentTarget = target;
        this.pageQueue = [];
        this.possibleTargets.clear();
        this.clearSubmitTimer();
    }

    private currentPage(): PageState {
        const page = this.pages.get(this.currentPageTitle);
        if (!page) {
            throw new Error(`页面尚未加载：${this.currentPageTitle}`);
        }
        return page;
    }

    private async processNextPage(): Promise<void> {
        if (!this.running) {
            return;
        }

        while (this.pageQueue.length > 0) {
            const queuedPage = this.pageQueue.shift();
            if (!queuedPage) {
                break;
            }

            const { startIndex, title } = queuedPage;
            this.currentPageTitle = title;
            this.currentLink = null;
            this.view.onBusy(true);
            this.view.onInfo(msg.loading);
            const page = this.pages.get(title) ?? (await this.loadPage(title));
            if (!page) {
                continue;
            }

            const link = findWikiLink(page.content, this.possibleTargets, startIndex);
            if (!link) {
                continue;
            }
            this.currentLink = link;
            this.view.onContext(title, page.content, link);
            this.view.onBusy(false);
            this.updateInfo();
            return;
        }

        this.currentLink = null;
        this.view.onBusy(false);
        this.running = false;
        this.view.onDone();
        this.updateInfo();
    }

    private async loadPage(title: string): Promise<PageState | null> {
        const data: PageData | null = await getPage(title);
        if (!data) {
            return null;
        }
        const state = { ...data, originalContent: data.content };
        this.pages.set(title, state);
        return state;
    }

    private async advance(startIndex: number): Promise<void> {
        const link = findWikiLink(this.currentPage().content, this.possibleTargets, startIndex);
        if (link) {
            this.currentLink = link;
            this.view.onContext(this.currentPageTitle, this.currentPage().content, link);
            this.updateInfo();
            this.scheduleSubmit();
            return;
        }
        await this.processNextPage();
        this.scheduleSubmit();
    }

    private record(kind: ActionRecord['kind'], contentBefore: string, link: WikiLink, summary: string): void {
        this.actions.push({
            contentBefore,
            kind,
            link: { ...link },
            pageTitle: this.currentPageTitle,
            summary,
        });
        if (this.actions.length > config.maxUndoEntries) {
            this.actions.shift();
        }
        this.updateInfo();
    }

    private updateInfo(): void {
        const count = [...this.pages.values()].filter(page => page.content !== page.originalContent).length;
        this.view.onChanges(count > 0);
        this.view.onInfo(count > 0 ? `待提交：${count} 页。` : '');
    }

    private scheduleSubmit(): void {
        this.clearSubmitTimer();
        if (this.hasUnsavedChanges) {
            this.submitTimer = window.setTimeout(() => void this.submit(), config.autoSubmitDelay);
        }
    }

    private clearSubmitTimer(): void {
        if (this.submitTimer !== null) {
            window.clearTimeout(this.submitTimer);
            this.submitTimer = null;
        }
    }
}

export { DisamSession };
