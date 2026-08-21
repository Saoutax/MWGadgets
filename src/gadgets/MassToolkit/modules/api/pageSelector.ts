import { simpleAlert } from '../components/alertWindow';
import { InputDialog, type UserInputOption } from '../components/inputDialog';
import { isDebugMode } from '../models/state';

/**
 * 页面选择器基类（列表器与过滤器共用）。
 */
export abstract class PageSelector {
    /** 各子类的输入字段定义 */
    static readonly inputs: UserInputOption[] = [];

    /** 当前选择条件的描述文本 */
    abstract getDescription(): string;
}

/**
 * 页面选择器类配置：用于动态实例化与自动生成输入表单。
 */
export interface SelectorConfig<T = unknown> {
    description: string;
    inputs: UserInputOption[];
    validator?(args: T): boolean;
    new (args: T): PageSelector;
}

type CallbackFunction = (selector: PageSelector) => void;

/**
 * 单个选择器的参数输入对话框。
 */
export class PageSelectorDialog extends OO.ui.ProcessDialog {
    static static = {
        ...OO.ui.ProcessDialog.static,
        name: 'pageSelectorInputDialog',
        title: '页面选择参数',
        tagName: 'div',
        actions: [
            { action: 'save', label: '完成', flags: ['primary', 'progressive'] },
            { label: '取消', flags: ['safe'] },
        ],
    };

    private widgets: Record<string, OO.ui.Widget> = {};
    private selectorClass?: SelectorConfig;

    /**
     * @param options 对话框配置
     * @param callback 确认后回调（传入实例化的选择器）
     */
    constructor(
        options: OO.ui.ProcessDialog.ConfigOptions,
        private readonly callback: CallbackFunction,
    ) {
        super(options);
    }

    /**
     * setup 阶段：根据选择器类生成输入表单。
     * @param data 包含 selectorClass 的打开数据
     */
    public getSetupProcess(data: { selectorClass: SelectorConfig }): OO.ui.Process {
        return super.getSetupProcess(data).next(() => {
            this.selectorClass = data.selectorClass;
            const result = InputDialog.setUpWidgets(data.selectorClass.inputs);
            this.widgets = result.widgets;
            const panel = new OO.ui.PanelLayout({ padded: true, expanded: true });
            panel.$element.append(result.fieldset.$element);
            this.$body.append(panel.$element);
        });
    }

    /**
     * 处理动作：校验输入、实例化选择器并回调。
     * @param action 动作名
     */
    public getActionProcess(action: string): OO.ui.Process {
        if (action === 'save' && this.selectorClass) {
            const SelectorClass = this.selectorClass;
            const result = InputDialog.getInputData(SelectorClass.inputs, this.widgets);
            if (!result.ok) {
                return new OO.ui.Process(() => {
                    simpleAlert('输入无效', result.error);
                });
            }
            const args = result.value;
            if (isDebugMode()) {
                console.log(args);
            }
            if (SelectorClass.validator && !SelectorClass.validator(args)) {
                return new OO.ui.Process(() => {});
            }
            return new OO.ui.Process(() => {
                this.callback(new SelectorClass(args));
                this.close();
            });
        }
        return super.getActionProcess(action);
    }

    public getBodyHeight(): number {
        return 500;
    }
}
