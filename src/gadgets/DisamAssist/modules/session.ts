import { getBacklinkData, getPage, savePage } from './api';
import { config } from './config';
import { msg } from './messages';
import { buildEditSummary } from './summary';
import type { ActionRecord, PageData, PageState, QueuedPage, SessionView, WikiLink } from './types';
import { findWikiLink, removeWikiLink, replaceWikiLink } from './wiki';

/**
 * 管理一次消歧义修复会话的状态机。
 *
 * 会话负责维护链入页面队列、页面工作副本、当前链接、撤销记录和自动提交计时器，
 * 通过 `SessionView` 把状态变化通知 UI；它本身不直接创建或操作 DOM。
 */
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

    /**
     * 创建一个尚未启动的会话。
     *
     * @param view 向面板推送忙碌状态、上下文、提示文字和完成状态的回调集合
     */
    constructor(private readonly view: SessionView) {}

    /**
     * 判断会话是否仍在处理页面。
     *
     * @returns 会话正在运行时返回 `true`
     */
    get isRunning(): boolean {
        return this.running;
    }

    /**
     * 判断会话中是否存在尚未提交的页面修改。
     *
     * `originalContent` 是当前提交基线，而不是永远不变的首次快照；保存成功后会更新它。
     *
     * @returns 至少一个页面内容不同于提交基线时返回 `true`
     */
    get hasUnsavedChanges(): boolean {
        return [...this.pages.values()].some(page => page.content !== page.originalContent);
    }

    /**
     * 启动针对目标页面的消歧义会话。
     *
     * 先获取目标页及其重定向别名的链入页面，再逐页查找待处理链接。重复启动会被忽略，
     * API 失败或没有链入页面时会通知用户并结束会话。
     *
     * @param target 本次会话要修复的目标页面标题
     * @returns 页面队列初始化并开始处理后的 Promise
     */
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

    /**
     * 用用户选择的候选标题替换当前链接。
     *
     * @param title 要替换成的页面标题
     * @returns 修改当前页面并定位下一链接后的 Promise
     */
    async chooseReplacement(title: string): Promise<void> {
        if (!this.running || !this.currentLink) {
            return;
        }
        const page = this.currentPage();
        const before = page.content;
        page.content = replaceWikiLink(page.content, this.currentLink, title);
        this.record('replace', before, this.currentLink, title);
        // 替换可能改变链接长度；从 start + 1 继续，避免重新命中刚处理的链接。
        await this.advance(this.currentLink.start + 1);
    }

    /**
     * 移除当前链接但保留其显示文字。
     *
     * @returns 修改当前页面并定位下一链接后的 Promise
     */
    async chooseRemoval(): Promise<void> {
        if (!this.running || !this.currentLink) {
            return;
        }
        const page = this.currentPage();
        const before = page.content;
        page.content = removeWikiLink(page.content, this.currentLink);
        this.record('remove', before, this.currentLink, msg.remove);
        // 删除后后续文本会左移到原 start，不能从旧 end 开始而跳过相邻链接。
        await this.advance(this.currentLink.start);
    }

    /**
     * 跳过当前链接并继续查找下一个候选。
     *
     * 跳过动作仍然进入撤销栈，使“上一步”能够回到刚跳过的链接；提交摘要会过滤它。
     *
     * @returns 定位下一链接后的 Promise
     */
    async skip(): Promise<void> {
        if (!this.running || !this.currentLink) {
            return;
        }
        const link = this.currentLink;
        this.record('skip', this.currentPage().content, link, msg.skipped);
        // 跳过不修改正文，因此从当前链接末尾继续扫描。
        await this.advance(link.end);
    }

    /**
     * 撤销最近一次操作并恢复对应页面的完整前态。
     *
     * 使用整页快照而不是反向计算，能够可靠处理变长替换、删除和跨页操作。
     */
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
                // 撤销跨页动作时，把刚离开的页面放回队列，避免丢失其剩余处理进度。
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

    /**
     * 提交所有发生实际内容变化的页面。
     *
     * 页面按顺序分别保存；单页失败不会阻断其他页面，失败页面保留脏状态和操作记录以便重试。
     * 保存成功后才更新提交基线和时间戳，并清理该页的撤销记录。
     *
     * @returns 所有变更页面处理完成后的 Promise
     */
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
                const response = await savePage(
                    title,
                    page.content,
                    page,
                    buildEditSummary(this.currentTarget, pageActions),
                );
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

    /**
     * 停止会话并通知 UI 收尾。
     *
     * 同时清理自动提交计时器，避免会话结束后旧回调继续发起保存请求。
     */
    stop(): void {
        this.running = false;
        this.clearSubmitTimer();
        this.view.onBusy(false);
        this.view.onDone();
    }

    /** 清空旧会话状态，并设置新的目标页面。 */
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

    /**
     * 取得当前页面的工作副本。
     *
     * 缺页表示内部状态已失去一致性，因此抛错而不是继续用空内容编辑。
     *
     * @returns 当前页面状态
     */
    private currentPage(): PageState {
        const page = this.pages.get(this.currentPageTitle);
        if (!page) {
            throw new Error(`页面尚未加载：${this.currentPageTitle}`);
        }
        return page;
    }

    /**
     * 消费页面队列并展示下一个待处理链接。
     *
     * 已缓存页面必须继续使用内存工作副本，否则重新请求会覆盖未提交修改；找不到链接的页面
     * 会被跳过，队列耗尽后才把会话标记为完成。
     */
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

    /**
     * 加载页面并建立可编辑的工作副本。
     *
     * `originalContent` 保存当前提交基线，后续用它判断页面是否变脏；页面缓存还负责保留未提交修改。
     *
     * @param title 要加载的页面标题
     * @returns 页面不存在时返回 `null`，否则返回已缓存页面状态
     */
    private async loadPage(title: string): Promise<PageState | null> {
        const data: PageData | null = await getPage(title);
        if (!data) {
            return null;
        }
        const state = { ...data, originalContent: data.content };
        this.pages.set(title, state);
        return state;
    }

    /**
     * 从指定位置继续扫描当前页面，必要时切换到下一页。
     *
     * 每次内容变化都重新解析链接，因为旧 `WikiLink` 的字符偏移只属于修改前的正文。
     *
     * @param startIndex 当前页面中下一次扫描的起始字符位置
     * @returns 扫描和界面更新完成后的 Promise
     */
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

    /**
     * 记录一次可撤销操作。
     *
     * 保存整页修改前内容和链接副本，避免后续内容长度变化导致无法可靠反向计算；超过上限时
     * 丢弃最旧记录，以限制长会话的内存占用。
     *
     * @param kind 操作类型
     * @param contentBefore 操作前的完整页面内容
     * @param link 操作发生时的链接信息
     * @param summary 该操作对应的摘要文字
     */
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

    /** 同步脏页数量、提交按钮状态和面板提示，避免各操作路径分别维护 UI。 */
    private updateInfo(): void {
        const count = [...this.pages.values()].filter(page => page.content !== page.originalContent).length;
        this.view.onChanges(count > 0);
        this.view.onInfo(count > 0 ? `待提交：${count} 页。` : '');
    }

    /**
     * 以最近一次操作为起点安排自动提交。
     *
     * 先清理旧计时器，使等待时间从最近一次操作重新计算，避免多个 timer 造成重复提交。
     */
    private scheduleSubmit(): void {
        this.clearSubmitTimer();
        if (this.hasUnsavedChanges) {
            this.submitTimer = window.setTimeout(() => void this.submit(), config.autoSubmitDelay);
        }
    }

    /** 清理当前自动提交计时器，并恢复空哨兵状态。 */
    private clearSubmitTimer(): void {
        if (this.submitTimer !== null) {
            window.clearTimeout(this.submitTimer);
            this.submitTimer = null;
        }
    }
}

export { DisamSession };
