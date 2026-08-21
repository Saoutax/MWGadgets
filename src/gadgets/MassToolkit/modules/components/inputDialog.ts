import { getNamespaces } from '../models/namespace';
import type { Result } from '../utils/result';

/** 输入字段类型 */
export enum InputType {
    PAGE,
    NAMESPACE,
    NAMESPACES,
    TEXT,
    MULTILINE_TEXT,
    SELECT,
    NUMBER,
    BOOLEAN,
    TIMESTAMP,
}

/** 校验结果 */
export type ValidationResult<T = string | number | boolean> = Result<T>;

/** 校验函数 */
export type ValidationFunction<T = string | number | boolean> = (value: T) => ValidationResult<T>;

/** 字段显示依赖：当 key 对应输入为指定布尔值时显示该字段 */
export interface InputDepends {
    key: string;
    /** 为 true 时表示依赖值取反（依赖输入为 false 时显示） */
    invert?: boolean;
}

/** 用户输入字段定义 */
export interface UserInputOption {
    key: string;
    label: string;
    type: InputType;
    options?: { data: string; label: string }[];
    defaultValue?: string | boolean | number;
    placeholder?: string;
    depends?: InputDepends | InputDepends[];
    validator?: ValidationFunction;
    help?: string | OO.ui.HtmlSnippet;
    rows?: number;
    optional?: boolean;
    min?: number;
}

/**
 * 输入表单工具：按字段定义生成 OO.ui 控件、读取并校验值。
 */
export class InputDialog {
    /**
     * 为字段定义生成控件与 Fieldset。
     * @param inputFields 字段定义
     * @param fieldsetOptions Fieldset 配置
     */
    public static setUpWidgets(
        inputFields: UserInputOption[],
        fieldsetOptions?: OO.ui.FieldsetLayout.ConfigOptions,
    ): { widgets: Record<string, OO.ui.Widget>; fieldset: OO.ui.FieldsetLayout } {
        const widgets: Record<string, OO.ui.Widget> = {};
        const fieldset = new OO.ui.FieldsetLayout(fieldsetOptions);
        for (const inputField of inputFields) {
            const { widget, align } = this.constructWidget(inputField);
            widgets[inputField.key] = widget;
            const layout = new OO.ui.FieldLayout(widget, {
                label: inputField.label,
                align,
                help: inputField.help,
            });
            fieldset.addItems([layout]);

            if (inputField.depends) {
                const depends = Array.isArray(inputField.depends) ? inputField.depends : [inputField.depends];
                const checkDependencies = () => {
                    const allMet = depends.every(dep => {
                        const depWidget = widgets[dep.key] as OO.ui.CheckboxInputWidget;
                        return depWidget.isSelected() !== !!dep.invert;
                    });
                    layout.toggle(allMet);
                };
                for (const dep of depends) {
                    widgets[dep.key]!.on('change', checkDependencies);
                }
                checkDependencies();
            }
        }
        return { widgets, fieldset };
    }

    /**
     * 按字段类型构造对应控件。
     * @param inputField 字段定义
     */
    private static constructWidget(inputField: UserInputOption): { widget: OO.ui.Widget; align: 'top' | 'inline' } {
        let align: 'top' | 'inline' = 'top';
        let widget: OO.ui.Widget;
        switch (inputField.type) {
            case InputType.BOOLEAN:
                widget = new OO.ui.CheckboxInputWidget({ selected: (inputField.defaultValue ?? false) as boolean });
                align = 'inline';
                break;
            case InputType.PAGE:
                widget = new mw.widgets.TitleInputWidget({
                    value: (inputField.defaultValue as string) ?? '',
                    suggestions: true,
                    required: true,
                });
                break;
            case InputType.NAMESPACE:
                widget = new OO.ui.ComboBoxInputWidget({
                    value: (inputField.defaultValue as string) ?? '',
                    options: getNamespaces().namespaces.map(ns => ({ data: ns.name, label: ns.name })),
                    menu: { filterFromInput: true },
                });
                break;
            case InputType.NAMESPACES:
                widget = new OO.ui.MenuTagMultiselectWidget({
                    selected: [],
                    options: getNamespaces().namespaces.map(ns => ({ data: ns.name, label: ns.name })),
                    allowArbitrary: true,
                    inputPosition: 'inline',
                    placeholder: '选择名字空间...',
                    menu: { filterFromInput: true },
                });
                break;
            case InputType.MULTILINE_TEXT:
                widget = new OO.ui.MultilineTextInputWidget({
                    value: (inputField.defaultValue as string) ?? '',
                    rows: inputField.rows ?? 5,
                });
                break;
            case InputType.SELECT: {
                const options = inputField.options!;
                if (options.length === 2) {
                    const buttonSelect = new OO.ui.ButtonSelectWidget({
                        items: options.map(option => new OO.ui.ButtonOptionWidget(option)),
                    });
                    if (inputField.defaultValue) {
                        buttonSelect.selectItemByData(inputField.defaultValue as string);
                    }
                    widget = buttonSelect;
                } else {
                    widget = new OO.ui.ComboBoxInputWidget({
                        menu: {
                            items: options.map(option => new OO.ui.MenuOptionWidget(option)),
                            filterFromInput: true,
                            filterMode: 'substring',
                        },
                        autocomplete: true,
                    });
                }
                break;
            }
            case InputType.TIMESTAMP:
                widget = new mw.widgets.datetime.DateTimeInputWidget({
                    value: (inputField.defaultValue as string) || undefined,
                });
                break;
            case InputType.NUMBER:
                // @types/oojs-ui 的 NumberInputWidget 声明与 Widget 不兼容，故断言
                widget = new OO.ui.NumberInputWidget({
                    value: (inputField.defaultValue as string) ?? '',
                    min: inputField.min,
                }) as unknown as OO.ui.Widget;
                break;
            default:
                widget = new OO.ui.TextInputWidget({
                    value: (inputField.defaultValue as string) ?? '',
                });
        }
        return { widget, align };
    }

    /**
     * 读取控件值并按字段定义校验。
     * @param inputFields 字段定义
     * @param widgets 控件表
     */
    public static getInputData(
        inputFields: UserInputOption[],
        widgets: Record<string, OO.ui.Widget>,
    ): Result<Record<string, string | number | boolean>> {
        const args: Record<string, string | number | boolean> = {};
        const validationErrors: Record<string, string> = {};
        for (const inputField of inputFields) {
            const widget = widgets[inputField.key];
            let rawValue: string | number | boolean;

            if (widget instanceof OO.ui.CheckboxInputWidget) {
                rawValue = widget.isSelected();
            } else if (widget instanceof OO.ui.MenuTagMultiselectWidget) {
                rawValue = (widget.getValue() as unknown as string[]).join('|');
            } else if (widget instanceof OO.ui.ButtonSelectWidget) {
                const selected = widget.findSelectedItem() as OO.ui.OptionWidget | null;
                rawValue = selected ? (selected.getData() as string) : '';
            } else if (widget instanceof OO.ui.NumberInputWidget) {
                rawValue = widget.getNumericValue();
            } else {
                rawValue = (widget as OO.ui.InputWidget).getValue() as string;
            }

            if (inputField.validator) {
                const validationResult = inputField.validator(rawValue);
                if (validationResult.ok) {
                    rawValue = validationResult.value;
                } else {
                    validationErrors[inputField.key] = validationResult.error;
                }
            }

            if (rawValue === '' && inputField.optional) {
                continue;
            }
            args[inputField.key] = rawValue;
        }

        if (Object.keys(validationErrors).length > 0) {
            return { ok: false, error: Object.values(validationErrors).join('\n') };
        }
        return { ok: true, value: args };
    }
}
