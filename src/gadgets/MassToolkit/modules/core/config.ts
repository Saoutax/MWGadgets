import { Config, state } from '../models/state';

/** 配置持久化的 localStorage 键 */
const LOCAL_STORAGE_KEY = 'masstoolkit-config';

/**
 * 保存配置到 localStorage。
 */
export function saveConfig(): void {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(state.config));
}

/** 将 value 限制在 [min, max] 区间内 */
function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

/**
 * 从 localStorage 加载配置（逐字段校验类型，解析失败或字段非法时保留默认值）。
 */
export function loadConfig(): void {
    const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!saved) {
        return;
    }
    try {
        const parsed = JSON.parse(saved) as Record<string, unknown>;
        const config = new Config();
        if (typeof parsed.debug === 'boolean') {
            config.debug = parsed.debug;
        }
        if (typeof parsed.summaryBot === 'string') {
            config.summaryBot = parsed.summaryBot;
        }
        if (typeof parsed.readThrottle === 'number' && !Number.isNaN(parsed.readThrottle)) {
            config.readThrottle = clamp(parsed.readThrottle, 0.1, 10);
        }
        if (typeof parsed.writeThrottle === 'number' && !Number.isNaN(parsed.writeThrottle)) {
            config.writeThrottle = clamp(parsed.writeThrottle, 0.5, 20);
        }
        if (typeof parsed.wakeLockEnabled === 'boolean') {
            config.wakeLockEnabled = parsed.wakeLockEnabled;
        }
        state.config = config;
    } catch (error) {
        console.error('MassToolkit: Failed to load configuration', error);
    }
}

/**
 * 全局设置对话框：编辑调试模式、bot 摘要、读写节流与唤醒锁。
 */
export class SettingsDialog extends OO.ui.ProcessDialog {
    static static = {
        ...OO.ui.ProcessDialog.static,
        name: 'settings',
        title: 'MassToolkit - 设置',
        tagName: 'div',
        actions: [
            { action: 'save', label: '保存', flags: ['primary', 'progressive'] },
            { label: '取消', flags: ['safe'] },
        ],
    };

    private debugInput!: OO.ui.CheckboxInputWidget;
    private summaryInput!: OO.ui.TextInputWidget;
    private readThrottleInput!: OO.ui.NumberInputWidget;
    private writeThrottleInput!: OO.ui.NumberInputWidget;
    private wakeLockEnabledInput!: OO.ui.CheckboxInputWidget;

    /**
     * 初始化控件并构建表单。
     */
    public initialize(): this {
        super.initialize();

        this.debugInput = new OO.ui.CheckboxInputWidget({ selected: state.config.debug });
        this.summaryInput = new OO.ui.TextInputWidget({ value: state.config.summaryBot });
        this.readThrottleInput = new OO.ui.NumberInputWidget({
            value: String(state.config.readThrottle),
            min: 0.1,
            max: 10,
        });
        this.writeThrottleInput = new OO.ui.NumberInputWidget({
            value: String(state.config.writeThrottle),
            min: 0.5,
            max: 20,
        });
        this.wakeLockEnabledInput = new OO.ui.CheckboxInputWidget({
            selected: state.config.wakeLockEnabled,
            disabled: !('wakeLock' in navigator),
        });

        const fieldset = new OO.ui.FieldsetLayout({ label: '全局 Bot 配置' });
        fieldset.addItems([
            new OO.ui.FieldLayout(this.debugInput, { label: '调试模式', align: 'inline' }),
            new OO.ui.FieldLayout(this.summaryInput, {
                label: 'Bot 编辑摘要（"$bot" 将被替换为该项）',
                align: 'top',
            }),
            new OO.ui.FieldLayout(this.readThrottleInput as unknown as OO.ui.Widget, {
                label: '读取节流（0.1s 至 10s）',
                align: 'top',
            }),
            new OO.ui.FieldLayout(this.writeThrottleInput as unknown as OO.ui.Widget, {
                label: '写入节流（0.5s 至 20s）',
                align: 'top',
            }),
            new OO.ui.FieldLayout(this.wakeLockEnabledInput, {
                label: '启用屏幕常亮',
                help: 'Bot 运行期间保持屏幕常亮',
                align: 'inline',
            }),
        ]);

        const mainPanel = new OO.ui.PanelLayout({ padded: true, expanded: false });
        mainPanel.$element.append(fieldset.$element);
        this.$body.append(mainPanel.$element);
        return this;
    }

    /**
     * 处理动作：保存时写回配置并持久化。
     * @param action 动作名
     */
    public getActionProcess(action: string): OO.ui.Process {
        if (action === 'save') {
            return new OO.ui.Process(() => {
                state.config.debug = this.debugInput.isSelected();
                state.config.summaryBot = this.summaryInput.getValue();
                state.config.readThrottle = Number(this.readThrottleInput.getValue());
                state.config.writeThrottle = Number(this.writeThrottleInput.getValue());
                state.config.wakeLockEnabled = this.wakeLockEnabledInput.isSelected();
                saveConfig();
                this.close();
            });
        }
        return super.getActionProcess(action);
    }

    public getBodyHeight(): number {
        return 350;
    }
}
