import { API } from '../api/mwApi';
import { openWindow } from './alertWindow';

/** 差异预览对话框的结果 */
interface DiffResult {
    action: 'accept' | 'acceptAll' | 'skip' | 'cancel';
}

/**
 * 将差异 HTML 包装为带固定列宽的表格。
 * @param diffResult compare API 返回的差异 HTML
 */
function formatDiff(diffResult: string): JQuery {
    const diffMarker =
        '<colgroup><col class="diff-marker"><col class="diff-content"><col class="diff-marker"><col class="diff-content"></colgroup>';
    return $('<table class="masstoolkit-diff" data-mw="interface" />').append(
        diffResult && diffMarker,
        $('<tbody />').append(
            diffResult ||
                '<tr><td colspan="2" class="diff-notice"><div class="mw-diff-empty">（无差异）</div></td></tr>',
        ),
    );
}

/**
 * 调用 compare API 获取差异 HTML。
 * @param original 原文
 * @param modified 修改后文本
 * @param title 页面标题
 */
async function compare(original: string, modified: string, title: string): Promise<JQuery> {
    const res = (await API.post({
        action: 'compare',
        fromslots: 'main',
        'fromtext-main': original,
        toslots: 'main',
        'totext-main': modified,
        prop: 'diff',
        fromtitle: title,
    })) as { compare: { body: string; '*': string } };
    // formatversion 2 下差异位于 compare.body；兼容 v1 的 '*' 字段
    return formatDiff(res.compare.body ?? res.compare['*']);
}

/**
 * 文本替换预览对话框：显示差异并提供接受/全部接受/跳过/取消。
 */
class DiffDialog extends OO.ui.ProcessDialog {
    static static = {
        ...OO.ui.ProcessDialog.static,
        name: 'diffDialog',
        title: '文本替换预览',
        tagName: 'div',
        actions: [],
    };

    private cancelButton!: OO.ui.ButtonWidget;
    private acceptAllButton!: OO.ui.ButtonWidget;
    private acceptButton!: OO.ui.ButtonWidget;
    private skipButton!: OO.ui.ButtonWidget;
    private diffContent!: OO.ui.PanelLayout;

    /**
     * @param pageTitle 页面标题
     * @param originalText 原文
     * @param newText 修改后文本
     */
    constructor(
        private readonly pageTitle: string,
        private readonly originalText: string,
        private readonly newText: string,
    ) {
        super({ size: 'large' });
    }

    /** 初始化底部按钮 */
    private initializeButtons(): void {
        this.cancelButton = new OO.ui.ButtonWidget({ label: '取消', flags: ['destructive'] });
        this.acceptAllButton = new OO.ui.ButtonWidget({ label: '全部接受', flags: ['progressive'] });
        this.acceptButton = new OO.ui.ButtonWidget({ label: '接受', flags: ['primary', 'progressive'] });
        this.skipButton = new OO.ui.ButtonWidget({ label: '跳过' });

        const $footerContainer = $('<div>')
            .css({ display: 'flex', justifyContent: 'space-between', padding: '12px' })
            .append(
                this.cancelButton.$element,
                $('<div>').append(this.skipButton.$element, this.acceptButton.$element, this.acceptAllButton.$element),
            );
        this.$foot.append($footerContainer);

        this.cancelButton.on('click', () => this.close({ action: 'cancel' } as DiffResult));
        this.skipButton.on('click', () => this.close({ action: 'skip' } as DiffResult));
        this.acceptButton.on('click', () => this.close({ action: 'accept' } as DiffResult));
        this.acceptAllButton.on('click', () => this.close({ action: 'acceptAll' } as DiffResult));
    }

    /**
     * 初始化界面并异步加载差异。
     */
    public initialize(): this {
        super.initialize();

        this.diffContent = new OO.ui.PanelLayout({ padded: true, expanded: false });
        const titleElement = $('<h3>').css('margin-top', '0').text(`页面：${this.pageTitle}`);
        const loadingElement = $('<div>').text('正在加载差异...');
        const diffContainer = $('<div>').css({ 'max-height': '400px', overflow: 'auto' }).append(loadingElement);

        this.diffContent.$element.append(titleElement, diffContainer);
        this.$body.append(this.diffContent.$element);

        this.initializeButtons();

        void compare(this.originalText, this.newText, this.pageTitle).then(diffElement => {
            loadingElement.replaceWith(diffElement);
        });

        return this;
    }

    public getBodyHeight(): number {
        return 500;
    }

    /**
     * 处理动作。
     * @param action 动作名
     */
    public getActionProcess(action: string): OO.ui.Process {
        if (['accept', 'acceptAll', 'skip', 'cancel'].includes(action)) {
            return new OO.ui.Process(() => {
                this.close({ action } as DiffResult);
            });
        }
        return super.getActionProcess(action);
    }
}

/**
 * 弹出差异预览对话框，返回用户选择。
 * @param pageTitle 页面标题
 * @param originalText 原文
 * @param newText 修改后文本
 */
export function showDiffDialog(pageTitle: string, originalText: string, newText: string): Promise<DiffResult> {
    return new Promise(resolve => {
        const dialog = new DiffDialog(pageTitle, originalText, newText);
        openWindow(dialog, {}, (data: DiffResult) => resolve(data));
    });
}
