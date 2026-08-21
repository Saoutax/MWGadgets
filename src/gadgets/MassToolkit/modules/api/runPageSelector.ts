import { openWindow, simpleAlert } from '../components/alertWindow';
import { PageInfo } from '../models/page';
import { cachePageInfo, isDebugMode } from '../models/state';
import { API } from './mwApi';
import { allPageFilters, PageFilter, RequiredPageInfo, type FilterArguments } from './pageFilter';
import { fetchPageCategories, fetchPageText } from './pageInfo';
import { allQueryLister, PageLister, type QueryArguments } from './pageLister';
import { PageSelector, PageSelectorDialog, type SelectorConfig } from './pageSelector';

type SelectorItem = SelectorConfig<QueryArguments> | SelectorConfig<FilterArguments>;
type CallbackFunction = (pages: PageInfo[]) => void;

/**
 * 页面选择条件对话框：选择列表器/过滤器组合出页面集合。
 */
class PageSelectionDialog extends OO.ui.ProcessDialog {
    static static = {
        ...OO.ui.ProcessDialog.static,
        name: 'pageSelectionDialog',
        title: '页面选择条件',
        tagName: 'div',
        actions: [
            { action: 'save', label: '完成', flags: ['primary', 'progressive'] },
            { label: '取消', flags: ['safe'] },
        ],
    };

    private indexLayout!: OO.ui.IndexLayout;
    private selectionContainer!: OO.ui.FieldsetLayout;
    private addedItems: PageSelector[] = [];
    private processingDialog: OO.ui.MessageDialog | null = null;

    /**
     * @param options 对话框配置
     * @param callback 完成回调（传入选中的页面）
     */
    constructor(
        options: OO.ui.ProcessDialog.ConfigOptions,
        private readonly callback: CallbackFunction,
    ) {
        super(options);
    }

    /**
     * 初始化界面：列表器/过滤器两个页签 + 底部已选规则区。
     */
    public initialize(): this {
        super.initialize();

        this.indexLayout = new OO.ui.IndexLayout({ expanded: false });
        const tab1 = new OO.ui.TabPanelLayout('tab1', { label: '页面列表器', expanded: false });
        const tab2 = new OO.ui.TabPanelLayout('tab2', { label: '页面过滤器', expanded: false });
        tab1.$element.append(...this.createActionRows(allQueryLister).map(field => field.$element));
        tab2.$element.append(...this.createActionRows(allPageFilters).map(field => field.$element));
        this.indexLayout.addTabPanels([tab1, tab2], 0);

        this.selectionContainer = new OO.ui.FieldsetLayout({
            label: '已应用的页面选择规则：',
            classes: ['masstoolkit-selected-items-box'],
        });

        const bottomPanel = new OO.ui.PanelLayout({ padded: false, expanded: false, framed: false });
        bottomPanel.$element.append(this.selectionContainer.$element);

        const panel = new OO.ui.PanelLayout({ padded: true, expanded: false });
        panel.$element.append(this.indexLayout.$element, $('<hr>'), bottomPanel.$element);
        this.$body.append(panel.$element);
        return this;
    }

    /**
     * 为每个可选项生成「Add」按钮行。
     * @param items 列表器或过滤器类配置
     */
    private createActionRows(items: SelectorItem[]): OO.ui.ActionFieldLayout[] {
        return items.map(item => {
            const button = new OO.ui.ButtonWidget({ label: '添加', flags: ['progressive'] });
            button.on('click', () => {
                void this.addItem(item);
            });
            return new OO.ui.ActionFieldLayout(
                new OO.ui.Widget({ content: [new OO.ui.LabelWidget({ label: item.description })] }),
                button,
                { align: 'top' },
            );
        });
    }

    /**
     * 弹出单项参数输入对话框，解析后返回选择器实例。
     * @param item 列表器或过滤器类配置
     */
    private promptUserInputForSelector(item: SelectorItem): Promise<PageSelector> {
        return new Promise(resolve => {
            const dialog = new PageSelectorDialog({ size: 'medium' }, (selector: PageSelector) => {
                resolve(selector);
            });
            openWindow(dialog, { selectorClass: item });
        });
    }

    /**
     * 添加一条选择规则到已选列表（带移除按钮）。
     * @param item 列表器或过滤器类配置
     */
    private async addItem(item: SelectorItem): Promise<void> {
        const instance = await this.promptUserInputForSelector(item);
        this.addedItems.push(instance);

        const removeButton = new OO.ui.ButtonWidget({ label: '移除', flags: ['destructive'], framed: false });
        const field = new OO.ui.ActionFieldLayout(
            new OO.ui.LabelWidget({ label: instance.getDescription(), classes: ['selected-item-row'] }),
            removeButton,
            { align: 'inline' },
        );
        removeButton.on('click', () => {
            const index = this.addedItems.indexOf(instance);
            if (index > -1) {
                this.addedItems.splice(index, 1);
            }
            this.selectionContainer.removeItems([field]);
            this.updateSize();
        });

        this.selectionContainer.addItems([field]);
        this.updateSize();
    }

    /**
     * 处理动作：完成时按规则抓取页面列表。
     * @param action 动作名
     */
    public getActionProcess(action: string): OO.ui.Process {
        if (action === 'save') {
            return new OO.ui.Process(() => {
                const cancelState = { cancelled: false };
                this.showProcessingPopup(cancelState);
                getPageListFromSelectionCriteria(this.addedItems, cancelState).then(
                    pages => {
                        if (cancelState.cancelled) {
                            return;
                        }
                        this.closeProcessingPopup();
                        mw.notify(`页面选择完成，共找到 ${pages.length} 个页面。`);
                        this.callback(pages);
                        this.close();
                    },
                    error => {
                        this.closeProcessingPopup();
                        console.error('Error fetching pages:', error);
                        simpleAlert('错误', `抓取页面失败：${error}`);
                    },
                );
            });
        }
        return super.getActionProcess(action);
    }

    /**
     * 显示抓取中的进度弹窗（可取消）。
     * @param state 取消状态标记
     */
    private showProcessingPopup(cancelState: { cancelled: boolean }): void {
        this.processingDialog = new OO.ui.MessageDialog();
        this.processingDialog.getActionProcess = action => {
            if (action === 'cancel') {
                return new OO.ui.Process(() => {
                    cancelState.cancelled = true;
                    this.closeProcessingPopup();
                });
            }
            return super.getActionProcess(action);
        };
        openWindow(this.processingDialog, {
            title: '正在抓取页面',
            message: '请稍候，正在根据您的条件抓取页面列表...',
            actions: [{ action: 'cancel', label: '取消', flags: ['safe'] }],
        });
    }

    /** 关闭抓取进度弹窗 */
    private closeProcessingPopup(): void {
        if (this.processingDialog) {
            this.processingDialog.close();
        }
    }

    public getBodyHeight(): number {
        return 800;
    }
}

/**
 * 为页面批量抓取过滤器所需的附加信息。
 * @param pages 页面
 * @param info 所需信息类型
 * @param state 取消状态
 */
async function fetchRequiredInfo(
    pages: PageInfo[],
    info: RequiredPageInfo[],
    state: { cancelled: boolean },
    api = API,
): Promise<void> {
    if (pages.length === 0) {
        return;
    }
    if (info.includes(RequiredPageInfo.TEXT)) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for await (const _ of fetchPageText(pages, api)) {
            if (state.cancelled) {
                return;
            }
        }
    }
    if (info.includes(RequiredPageInfo.CATEGORY)) {
        await fetchPageCategories(pages, api);
    }
}

/**
 * 根据已选规则组合出页面集合：依次应用列表器、简单过滤器、复杂过滤器。
 * @param selectedItems 已选选择器实例
 * @param state 取消状态
 */
async function getPageListFromSelectionCriteria(
    selectedItems: PageSelector[],
    state: { cancelled: boolean },
): Promise<PageInfo[]> {
    const listers: PageLister[] = [];
    const filters: PageFilter[] = [];
    for (const item of selectedItems) {
        if (item instanceof PageLister) {
            listers.push(item);
        } else {
            filters.push(item as PageFilter);
        }
    }
    if (isDebugMode()) {
        console.log('Selected page generators:', selectedItems);
    }

    let allPages: PageInfo[] = [];
    for (const lister of listers) {
        for await (const prop of lister.getNext()) {
            if (state.cancelled) {
                return allPages;
            }
            const info = new PageInfo({ title: prop.title });
            allPages.push(info);
            cachePageInfo(info);
        }
    }

    const simpleFilters = filters.filter(filter => filter.requiredInfo.length === 0);
    for (const filter of simpleFilters) {
        allPages = allPages.filter(page => filter.test(page));
    }

    const complexFilters = filters.filter(filter => filter.requiredInfo.length !== 0);
    const requiredInfo = new Set<RequiredPageInfo>();
    for (const filter of complexFilters) {
        for (const info of filter.requiredInfo) {
            requiredInfo.add(info);
        }
    }
    await fetchRequiredInfo(allPages, Array.from(requiredInfo), state);
    if (state.cancelled) {
        return allPages;
    }
    for (const filter of complexFilters) {
        allPages = allPages.filter(page => filter.test(page));
    }
    return allPages;
}

/**
 * 打开页面选择器对话框，返回用户选中的页面集合。
 */
export function runPageSelector(): Promise<PageInfo[]> {
    return new Promise<PageInfo[]>(resolve => {
        const dialog = new PageSelectionDialog({ size: 'medium', classes: ['masstoolkit-page-selector'] }, pages => {
            resolve(pages);
        });
        openWindow(dialog);
    });
}
