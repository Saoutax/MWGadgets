import { shouldLoad, hasSuffix } from './check';
import { config, DISAMBIGUATION_SUFFIX } from './config';
import { msg } from './messages';
import { getPage } from './api';
import { DisamSession } from './session';
import { createPanel, markCandidateOptions } from './ui';
import { contextAround, parseDisambiguationTargets } from './wiki';

const portletId = () => (document.querySelector('#p-cactions') ? 'p-cactions' : 'p-tb');

const addPortletLink = (label: string, id: string, tooltip: string, target: string) => {
    const item = mw.util.addPortletLink(portletId(), '#', label, id, tooltip);
    item?.querySelector('a')?.addEventListener('click', event => {
        event.preventDefault();
        void openSession(target);
    });
};

let activeSession: DisamSession | null = null;
let activePanel: ReturnType<typeof createPanel> | null = null;
let removeCandidateMarkers: (() => void) | null = null;

const openSession = async (target: string) => {
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
        previous: () => activeSession?.undo(),
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
        removeCandidateMarkers = markCandidateOptions(candidateTargets, title => void activeSession?.chooseReplacement(title));
    } catch (error) {
        console.error('[DisamAssist] 获取候选条目失败：', error);
    }
    await activeSession.start(target);
};

const start = () => {
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
