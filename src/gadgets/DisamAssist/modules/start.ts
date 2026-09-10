import { getPage } from './api';
import { shouldLoad, hasSuffix } from './check';
import { config, DISAMBIGUATION_SUFFIX } from './config';
import { msg } from './messages';
import { DisamSession } from './session';
import { createPanel, markCandidateOptions } from './ui';
import { contextAround, parseDisambiguationTargets } from './wiki';

/** 选择 MediaWiki 当前皮肤中用于放置 gadget 入口的 portlet。 */
const portletId = (): string => (document.querySelector('#p-cactions') ? 'p-cactions' : 'p-tb');

/**
 * 在 portlet 中创建一个会话入口。
 *
 * @param label 入口显示文本
 * @param id 入口元素的 DOM id
 * @param tooltip 入口的辅助提示文本
 * @param target 点击后要修复的目标页面标题
 */
const addPortletLink = (label: string, id: string, tooltip: string, target: string): void => {
    const item = mw.util.addPortletLink(portletId(), '#', label, id, tooltip);
    item?.querySelector('a')?.addEventListener('click', event => {
        event.preventDefault();
        void openSession(target);
    });
};

let activeSession: DisamSession | null = null;
let activePanel: ReturnType<typeof createPanel> | null = null;
let removeCandidateMarkers: (() => void) | null = null;

/**
 * 创建并启动一个目标页面修复会话。
 *
 * 本函数负责组装面板、会话和当前消歧义页的候选标记。开始新会话前先清理旧资源，避免旧面板、
 * marker 或回调继续影响页面；候选页读取失败只影响快捷标记，不阻止主要的链入页面处理流程。
 *
 * @param target 要修复的目标页面标题
 * @returns 会话初始化完成后的 Promise
 */
const openSession = async (target: string): Promise<void> => {
    if (activeSession?.isRunning) {
        mw.notify('DisamAssist 已在运行。', { type: 'warn' });
        return;
    }

    removeCandidateMarkers?.();
    removeCandidateMarkers = null;
    activePanel?.destroy();
    activePanel = null;
    activeSession = null;

    const panel = createPanel({
        close: () => {
            if (activeSession?.hasUnsavedChanges && !window.confirm(msg.unsavedChanges)) {
                return;
            }
            removeCandidateMarkers?.();
            removeCandidateMarkers = null;
            activeSession?.stop();
            panel.destroy();
            activePanel = null;
            activeSession = null;
        },
        next: () => void activeSession?.skip(),
        previous: () => void activeSession?.undo(),
        remove: () => void activeSession?.chooseRemoval(),
        submit: () => void activeSession?.submit(),
    });

    activeSession = new DisamSession({
        onBusy: busy => panel?.setState(busy ? 'busy' : 'active'),
        onChanges: hasChanges => panel?.setSubmitEnabled(hasChanges),
        onContext: (title, content, link) => {
            panel?.setPage(title);
            panel?.setContext(contextAround(content, link, config.contextRadius));
        },
        onDone: () => {
            removeCandidateMarkers?.();
            removeCandidateMarkers = null;
            panel?.setState('done');
        },
        onInfo: text => panel?.setInfo(text),
    });
    activePanel = panel;
    panel.show();
    const { wgPageName = '' } = mw.config.get();
    try {
        const currentPage = await getPage(wgPageName);
        const candidateTargets = new Set(parseDisambiguationTargets(currentPage?.content ?? ''));
        // 快捷按钮只标记当前消歧义页的候选链接，避免把普通列表链接误当成替换目标。
        removeCandidateMarkers = markCandidateOptions(
            candidateTargets,
            title => void activeSession?.chooseReplacement(title),
        );
    } catch (error) {
        console.error('[DisamAssist] 获取候选条目失败：', error);
    }
    await activeSession.start(target);
};

/**
 * 根据当前页面环境创建 DisamAssist 的 portlet 入口。
 *
 * 带 `(消歧义页)` 后缀的页面同时提供指向主条目和当前页面的两种修复入口；两者代表不同的
 * 用户意图，不能合并为同一个目标。非后缀页面只提供指向当前页面的入口。
 */
const start = (): void => {
    if (!shouldLoad()) {
        return;
    }

    const { wgPageName = '' } = mw.config.get();
    if (hasSuffix()) {
        const mainTitle = wgPageName.slice(0, -DISAMBIGUATION_SUFFIX.length);
        addPortletLink(msg.portletMain, 'ca-disamassist', '修复指向主条目的链接', mainTitle);
        addPortletLink(msg.portletPage, 'ca-disamassist-same', '修复指向当前页面的链接', wgPageName);
    } else {
        addPortletLink(msg.portletPage, 'ca-disamassist-page', '修复指向当前页面的链接', wgPageName);
    }
};

export { openSession, start };
