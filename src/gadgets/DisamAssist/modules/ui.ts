import './styles.scss';
import { msg } from './messages';
import type { Panel, PanelCallbacks } from './types';
import { extractPageName, normalizeTitle } from './wiki';

/**
 * 创建一个普通按钮，统一设置按钮类型、显示文本和可选样式类。
 *
 * @param label 按钮显示文本
 * @param className 可选的 CSS 类名
 * @returns 已配置的按钮元素
 */
const button = (label: string, className?: string): HTMLButtonElement => {
    const element = document.createElement('button');
    element.type = 'button';
    element.textContent = label;
    if (className) {
        element.className = className;
    }
    return element;
};

/**
 * 创建并挂载 DisamAssist 面板。
 *
 * 面板集中管理页面标题、上下文、状态和操作按钮，并通过 `Panel` 接口向会话暴露最小控制面。
 * 用户内容使用 DOM API 写入而非拼接 HTML，避免页面文本被当作标记解释。
 *
 * @param callbacks 面板按钮对应的会话操作回调
 * @returns 可由 session/start 控制状态、内容和生命周期的面板接口
 */
const createPanel = (callbacks: PanelCallbacks): Panel => {
    const box = document.createElement('section');
    box.className = 'disamassist-box';
    box.hidden = true;
    box.setAttribute('aria-live', 'polite');

    const head = document.createElement('div');
    head.className = 'disamassist-head';
    const titleContainer = document.createElement('div');
    titleContainer.className = 'disamassist-title';
    const stateIndicator = document.createElement('span');
    stateIndicator.className = 'disamassist-state';
    stateIndicator.setAttribute('role', 'status');
    head.append(titleContainer, stateIndicator);

    const workspace = document.createElement('div');
    workspace.className = 'disamassist-workspace';
    const contextLabel = document.createElement('div');
    contextLabel.className = 'disamassist-context-label';
    contextLabel.textContent = msg.context;
    const context = document.createElement('pre');
    context.className = 'disamassist-context';
    workspace.append(contextLabel, context);

    const info = document.createElement('span');
    info.className = 'disamassist-status';
    info.setAttribute('role', 'status');
    const toolbar = document.createElement('div');
    toolbar.className = 'disamassist-toolbar';
    const primaryActions = document.createElement('div');
    primaryActions.className = 'disamassist-primary-actions';
    const secondaryActions = document.createElement('div');
    secondaryActions.className = 'disamassist-secondary-actions';
    const navigation = document.createElement('div');
    navigation.className = 'disamassist-navigation';
    const editing = document.createElement('div');
    editing.className = 'disamassist-editing';
    const commit = document.createElement('div');
    commit.className = 'disamassist-commit';
    const closing = document.createElement('div');
    closing.className = 'disamassist-close';

    const previous = button(`← ${msg.previous}`);
    const next = button(`${msg.next} →`);
    const remove = button(msg.remove);
    const submit = button(msg.submit, 'disamassist-primary');
    const close = button(msg.close, 'disamassist-danger');
    navigation.append(previous, next);
    editing.append(remove);
    primaryActions.append(navigation, editing);
    commit.append(submit);
    closing.append(close);
    secondaryActions.append(info, commit, closing);
    toolbar.append(primaryActions, secondaryActions);
    box.append(head, workspace, toolbar);

    const content = document.querySelector('#mw-content-text') ?? document.querySelector('#bodyContent');
    content?.parentNode?.insertBefore(box, content);

    previous.addEventListener('click', callbacks.previous);
    next.addEventListener('click', callbacks.next);
    remove.addEventListener('click', callbacks.remove);
    submit.addEventListener('click', callbacks.submit);
    close.addEventListener('click', callbacks.close);

    /** 根据会话状态统一更新按钮可用性和工作区可见性。 */
    const setState = (status: 'active' | 'busy' | 'done'): void => {
        const busy = status === 'busy';
        const done = status === 'done';
        box.dataset.state = status;
        // busy 时禁止并发操作，done 时隐藏工作区，避免异步请求期间状态继续变化。
        previous.disabled = busy || done;
        next.disabled = busy || done;
        remove.disabled = busy || done;
        submit.disabled = busy || done;
        close.disabled = busy;
        workspace.hidden = done;
        stateIndicator.textContent = done ? msg.completed : msg.processing;
        if (done) {
            info.textContent = '';
        }
    };

    setState('busy');
    submit.disabled = true;

    return {
        destroy: () => box.remove(),
        setContext: ([before, link, after]) => {
            context.replaceChildren();
            context.append(document.createTextNode(before));
            const highlight = document.createElement('mark');
            highlight.className = 'disamassist-highlight';
            highlight.textContent = link;
            context.append(highlight, document.createTextNode(after));
            context.hidden = false;
        },
        setInfo: text => {
            info.textContent = text;
        },
        setPage: pageTitle => {
            titleContainer.replaceChildren();
            const label = document.createElement('span');
            label.className = 'disamassist-title-label';
            label.textContent = `${msg.target}：`;
            const link = document.createElement('a');
            link.className = 'disamassist-title-link';
            link.href = mw.util.getUrl(pageTitle, { redirect: 'no' });
            link.textContent = pageTitle;
            titleContainer.append(label, link);
        },
        setState,
        setSubmitEnabled: enabled => {
            submit.disabled = !enabled;
        },
        show: () => {
            box.hidden = false;
        },
    };
};

/**
 * 为消歧义页列表中的候选链接添加“替换”快捷按钮。
 *
 * 只处理候选集合中的同页链接，并返回清理函数供会话结束或页面切换时移除动态按钮，避免重复标记。
 * 点击按钮会阻止原链接跳转和事件冒泡，确保用户只触发替换操作。
 *
 * @param candidateTargets 当前消歧义页解析出的候选标题集合
 * @param onChoose 用户点击某个候选标题后的回调
 * @returns 移除本次添加的所有快捷按钮的清理函数
 */
const markCandidateOptions = (
    candidateTargets: ReadonlySet<string>,
    onChoose: (title: string) => void,
): (() => void) => {
    const markers: HTMLButtonElement[] = [];
    document.querySelectorAll<HTMLAnchorElement>('#mw-content-text ul > li a[href]').forEach(link => {
        if (link.closest('.disamassist-box')) {
            return;
        }

        const title = extractPageName(link);
        if (!title || link.target === '_blank' || !candidateTargets.has(normalizeTitle(title) ?? title)) {
            return;
        }

        const marker = document.createElement('button');
        marker.type = 'button';
        marker.className = 'disamassist-option';
        marker.textContent = '替换';
        marker.title = `替换为「${title}」`;
        marker.setAttribute('aria-label', marker.title);
        marker.addEventListener('click', event => {
            event.preventDefault();
            event.stopPropagation();
            onChoose(title);
        });
        link.insertAdjacentElement('afterend', marker);
        markers.push(marker);
    });

    return () => markers.forEach(marker => marker.remove());
};

export { createPanel, markCandidateOptions };
