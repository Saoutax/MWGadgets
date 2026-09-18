import type { TemplateParam } from './types';

/** 一个参数对应的控件、布局与定义。 */
interface ParamField {
    param: TemplateParam;
    widget: OO.ui.TextInputWidget;
    layout: OO.ui.FieldLayout<OO.ui.TextInputWidget>;
}

/**
 * 按参数类型创建控件。
 * mw.widgets.TitleInputWidget 与 MultilineTextInputWidget 都继承自 TextInputWidget，
 * 因此统一以 TextInputWidget 返回，便于共用 getValue / setValidityFlag。
 * @param param 参数定义
 * @param $overlay 窗口的 overlay 节点，交给带弹出层的控件，避免菜单被窗口 body 裁剪
 */
const createParamWidget = (param: TemplateParam, $overlay: JQuery): OO.ui.TextInputWidget => {
    const value = param.default ?? '';
    switch (param.type ?? 'text') {
        case 'page':
            return new mw.widgets.TitleInputWidget({ value, suggestions: true, $overlay });
        case 'multiline':
            return new OO.ui.MultilineTextInputWidget({ value, rows: 4, autosize: true, maxRows: 12 });
        default:
            return new OO.ui.TextInputWidget({ value });
    }
};

/**
 * 创建参数控件并包一层 FieldLayout。
 * @param param 参数定义
 * @param $overlay 窗口的 overlay 节点
 */
const createParamField = (param: TemplateParam, $overlay: JQuery): ParamField => {
    const widget = createParamWidget(param, $overlay);
    return { param, widget, layout: new OO.ui.FieldLayout(widget, { label: param.label, align: 'top' }) };
};

/**
 * 读取各参数的当前值。
 * @param fields 参数字段
 */
const readValues = (fields: ParamField[]): Record<string, string> => {
    const values: Record<string, string> = {};
    for (const field of fields) {
        values[field.param.key] = field.widget.getValue();
    }
    return values;
};

/**
 * 校验必填项，就地更新控件的 validity 与错误文案。
 * @param fields 参数字段
 * @returns 第一个非法字段；全部合法时为 null
 */
const validateFields = (fields: ParamField[]): ParamField | null => {
    let firstInvalid: ParamField | null = null;
    for (const field of fields) {
        const empty = field.widget.getValue().trim() === '';
        const invalid = (field.param.required ?? false) && empty;
        field.widget.setValidityFlag(!invalid);
        field.layout.setErrors(invalid ? [`${field.param.label}不能为空`] : []);
        if (invalid && !firstInvalid) {
            firstInvalid = field;
        }
    }
    return firstInvalid;
};

/**
 * 清空所有校验状态。
 * @param fields 参数字段
 */
const clearErrors = (fields: ParamField[]): void => {
    for (const field of fields) {
        field.widget.setValidityFlag();
        field.layout.setErrors([]);
    }
};

export {
    type ParamField,
    clearErrors,
    createParamField,
    createParamWidget,
    readValues,
    validateFields,
};
