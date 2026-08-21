import { runPageSelector } from '../api/runPageSelector';
import { openWindow, simpleAlert, type WindowResult } from '../components/alertWindow';
import { InputDialog, type UserInputOption } from '../components/inputDialog';
import { LogSeverity, ProgressWindow } from '../components/progressWindow';
import { PageInfo } from '../models/page';
import { state } from '../models/state';
import { getUserRights } from '../models/userRight';
import type { Result } from '../utils/result';

/** Bot 单批处理结果 */
export interface BotResult {
    severity: LogSeverity;
    message: string;
}

/** Bot 配置选项 */
export interface BotSetupOptions<TConfig extends { pages: string[] }, BotState = never> {
    /** 名称 */
    name: string;
    /** 描述（显示在 Bot 选择器） */
    description: string;
    /** 每批处理的页面数，默认 1 */
    batchSize?: number | ((config: TConfig) => number);
    /** 创建配置对话框 */
    createConfigDialog: () => BotConfigurationDialog<TConfig>;
    /** 处理一批页面 */
    processBatch: (
        pages: PageInfo[],
        config: TConfig,
        state: BotState,
        bot: Bot<TConfig, BotState>,
    ) => Promise<BotResult | BotResult[]>;
    /** 批次处理前的页面预处理（如抓取正文），默认原样透传 */
    preprocessPages?: (pages: PageInfo[], config: TConfig) => AsyncGenerator<PageInfo> | PageInfo[];
    /** 全部批次处理完后的收尾 */
    finalizePages?: (config: TConfig, state: BotState) => Promise<void>;
    /** 运行所需的权限 */
    rights?: string[];
}

/**
 * 批量操作 Bot 框架：负责分页、进度窗口、取消与收尾。
 */
export class Bot<T extends { pages: string[] }, State = never> {
    private static readonly cancelledMessage = 'Bot 已取消。';

    private progressWindow?: ProgressWindow;
    private cancelled = false;
    private botState = {} as State;
    private readonly batchSize: (config: T) => number;

    /** Bot 名称 */
    public readonly name: string;
    /** Bot 描述（显示在 Bot 选择器） */
    public readonly description: string;

    /**
     * @param options Bot 配置
     */
    constructor(public readonly options: BotSetupOptions<T, State>) {
        this.name = options.name;
        this.description = options.description;
        const size = options.batchSize;
        this.batchSize = typeof size === 'number' ? () => size : (size ?? (() => 1));
        if (!options.preprocessPages) {
            options.preprocessPages = this.defaultPreprocess;
        }
    }

    /** 默认预处理：原样透传 */
    private async *defaultPreprocess(pages: PageInfo[]): AsyncGenerator<PageInfo> {
        yield* pages;
    }

    /** 请求取消 */
    cancel(): void {
        this.cancelled = true;
    }

    /** 是否可运行（权限满足） */
    isAvailable(): boolean {
        const requiredRights = this.options.rights;
        if (requiredRights && requiredRights.length > 0) {
            const allRights = state.cache.allUserRights;
            const userRights = getUserRights();
            // 若某权限在当前站点根本不存在（如对应扩展未安装），则忽略该权限
            return requiredRights.every(right => !allRights.has(right) || userRights?.includes(right));
        }
        return true;
    }

    /** 弹出配置对话框并在确认后开始处理 */
    fetchConfig(): Promise<void> {
        const dialog = this.options.createConfigDialog();
        return openBotConfigDialog(dialog, config => this.processPages(config));
    }

    /**
     * 按配置执行批量处理。
     * @param config 完整配置（含页面列表）
     */
    async processPages(config: T): Promise<void> {
        this.cancelled = false;
        this.botState = {} as State;
        const pages = config.pages.map(title => new PageInfo({ title }));
        if (pages.length === 0) {
            simpleAlert('错误', '未找到有效页面，请检查页面标题后重试。');
            return;
        }
        this.progressWindow = new ProgressWindow(pages.length, () => this.cancel());

        const processBatch = async (batch: PageInfo[]) => {
            const results = await this.options.processBatch(batch, config, this.botState, this);
            const entries: BotResult[] = Array.isArray(results) ? results : [results];
            for (const entry of entries) {
                this.progressWindow!.addLog(entry.severity, entry.message);
            }
            // 进度按批次推进一次，与日志条目数量解耦，避免多结果 Bot 超过 total 提前完成
            this.progressWindow!.makeProgress(batch.length);
        };

        let batch: PageInfo[] = [];
        for await (const page of this.options.preprocessPages!(pages, config)) {
            if (this.checkCancelled()) {
                return;
            }
            batch.push(page);
            if (batch.length >= this.batchSize(config)) {
                await processBatch(batch);
                batch = [];
            }
        }
        if (batch.length > 0) {
            await processBatch(batch);
        }
        if (this.options.finalizePages !== undefined) {
            await this.options.finalizePages(config, this.botState);
        }
        this.progressWindow.done();
    }

    /** 检查是否已取消，已取消时在进度窗提示并返回 true */
    private checkCancelled(): boolean {
        if (this.cancelled) {
            this.progressWindow!.addLog(LogSeverity.WARNING, Bot.cancelledMessage);
            this.progressWindow!.hideCancelButton();
            return true;
        }
        return false;
    }
}

/**
 * 打开配置对话框，并绑定处理回调。
 * @param dialog 配置对话框
 * @param callback 用户确认配置后的回调
 */
export async function openBotConfigDialog<T>(
    dialog: BotConfigurationDialog<T>,
    callback: (t: T) => Promise<void>,
): Promise<void> {
    return new Promise(resolve => {
        dialog.callback = callback;
        openWindow<WindowResult<T>>(dialog, {}, async () => {
            resolve();
        });
    });
}

/**
 * 等同于 UserInputOption[]，但保证 key 属于 T，防止拼写错误。
 */
export type InputConfig<T> = Array<
    { [K in Extract<keyof T, string>]: Omit<UserInputOption, 'key'> & { key: K } }[Extract<keyof T, string>]
>;

/** 配置对话框选项 */
export interface BotConfigurationOptions<T> {
    dialogConfig?: OO.ui.Dialog.ConfigOptions;
    inputOptions: InputConfig<T>;
    validator?: (data: T) => boolean;
}

/**
 * 通用的两步配置对话框：第一步选页面，第二步填 Bot 参数。
 */
export class BotConfigurationDialog<T> extends OO.ui.ProcessDialog {
    static static = {
        ...OO.ui.ProcessDialog.static,
        name: 'configurebot',
        title: '配置 Bot',
        tagName: 'div',
        actions: [
            { action: 'next', label: '下一步', flags: ['progressive', 'primary'], modes: ['step1'] },
            { action: 'back', label: '上一步', modes: ['step2'] },
            { action: 'done', label: '开始执行', flags: ['progressive', 'primary'], modes: ['step2'] },
            { label: '取消', flags: ['safe'], modes: ['step1', 'step2'] },
        ],
    };

    private stack!: OO.ui.StackLayout;
    private step1!: OO.ui.PanelLayout;
    private step2!: OO.ui.PanelLayout;
    private step2Widgets!: Record<string, OO.ui.Widget>;
    private pages: string[] = [];
    private manualPagesInput!: OO.ui.MultilineTextInputWidget;
    /** 配置确认回调（由 openBotConfigDialog 注入） */
    public callback?: (t: T) => Promise<void>;

    /**
     * @param config 配置选项
     */
    constructor(private readonly config: BotConfigurationOptions<T>) {
        super(config.dialogConfig);
    }

    /**
     * 初始化：搭建两个步骤的面板与 StackLayout。
     */
    public initialize(): this {
        super.initialize();
        this.setupStep1();
        this.setupStep2();
        this.stack = new OO.ui.StackLayout({ items: [this.step1, this.step2] });
        this.$body.append(this.stack.$element);
        return this;
    }

    /** 第一步：页面选择（页面选择器工具或手动输入） */
    private setupStep1(): void {
        const pageSelectorButton = new OO.ui.ButtonWidget({ label: '使用页面选择器', flags: ['progressive'] });
        this.manualPagesInput = new OO.ui.MultilineTextInputWidget({
            placeholder: '每行输入一个页面标题',
            rows: 10,
        });
        pageSelectorButton.on('click', () => {
            void runPageSelector().then(pageInfoList => {
                const pageTitles = pageInfoList.map(page => page.title).join('\n');
                const existing = this.manualPagesInput.getValue().trim();
                this.manualPagesInput.setValue(existing ? `${existing}\n${pageTitles}` : pageTitles);
            });
        });

        this.step1 = new OO.ui.PanelLayout({ padded: true, expanded: false });
        const step1Fieldset = new OO.ui.FieldsetLayout({
            label: '选择要处理的页面',
            items: [
                new OO.ui.FieldLayout(pageSelectorButton, { label: '页面选择器工具', align: 'top' }),
                new OO.ui.FieldLayout(this.manualPagesInput, {
                    label: '页面标题',
                    align: 'top',
                    help: '点击上方按钮使用工具选择页面，或手动输入页面标题。',
                }),
            ],
        });
        this.step1.$element.append(step1Fieldset.$element);
    }

    /** 第二步：Bot 参数表单 */
    private setupStep2(): void {
        const res = InputDialog.setUpWidgets(this.config.inputOptions, { label: 'Bot 附加设置' });
        this.step2Widgets = res.widgets;
        this.step2 = new OO.ui.PanelLayout({ padded: true, expanded: false });
        this.step2.$element.append(res.fieldset.$element);
    }

    /** 读取第二步表单数据 */
    private getSecondStepData(): Result<Omit<T, 'pages'>> {
        return InputDialog.getInputData(this.config.inputOptions, this.step2Widgets) as Result<Omit<T, 'pages'>>;
    }

    /**
     * 校验完整配置。
     * @param data 配置
     */
    private validate(data: T): boolean {
        return this.config.validator ? this.config.validator(data) : true;
    }

    /**
     * 处理动作（下一步/上一步/开始）。
     * @param action 动作名
     */
    public getActionProcess(action: string): OO.ui.Process {
        if (action === 'next') {
            return new OO.ui.Process(() => {
                const manualText = this.manualPagesInput.getValue().trim();
                const pages = manualText.split('\n').filter(page => page.trim());
                if (pages.length === 0) {
                    simpleAlert('错误', '至少需要指定 1 个页面。');
                    return;
                }
                this.pages = Array.from(new Set(pages));
                this.stack.setItem(this.step2);
                this.actions.setMode('step2');
            });
        }
        if (action === 'back') {
            return new OO.ui.Process(() => {
                this.stack.setItem(this.step1);
                this.actions.setMode('step1');
            });
        }
        if (action === 'done') {
            return new OO.ui.Process(() => {
                const result = this.getSecondStepData();
                if (!result.ok) {
                    simpleAlert('输入无效', result.error);
                    return;
                }
                const data = { ...result.value, pages: this.pages } as T;
                if (!this.validate(data)) {
                    return;
                }
                if (this.callback) {
                    void this.callback(data);
                }
                // 关闭配置对话框，触发 openBotConfigDialog 的 Promise resolve，并防止重复点击"开始执行"
                this.close({ action: 'done' });
            });
        }
        return super.getActionProcess(action);
    }

    public getSetupProcess(data?: never): OO.ui.Process {
        return super.getSetupProcess(data).next(() => {
            this.stack.setItem(this.step1);
            this.actions.setMode('step1');
        });
    }

    public getBodyHeight(): number {
        return 400;
    }
}
