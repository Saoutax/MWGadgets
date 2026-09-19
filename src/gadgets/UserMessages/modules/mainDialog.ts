import { fetchPageContentOrThrow, parseWikitext } from './api';
import { findTemplate, getSignatureSuffix } from './config';
import { DIALOG_SIZE, MAX_MAIN_BODY_HEIGHT } from './constants';
import { createParamField, readValues, validateFields, type ParamField } from './fields';
import { showError } from './messageDialog';
import { asStep } from './process';
import { loadPersisted, savePersisted } from './storage';
import type { MainDialogData, PreviewDialogData, PreviewSubmission, TemplateEntry, UserMessagesConfig } from './types';
import { buildPresetWikitext, buildSubmitText, stripNoInclude } from './wikitext';

/**
 * 主对话框：选择模板、填写参数（或自定义内容）、填写编辑摘要，然后进入预览。
 *
 * 模板列表在打开时才可用，因此 initialize 只搭出「加载中 / 表单」两个容器，
 * 真正的表单在 getSetupProcess 里等预取落定后再构建。
 */
class MainDialog extends OO.ui.ProcessDialog {
    /**
     * 必须逐项写全：OO.inheritClass 用 Object.create 继承静态成员，
     * { ...OO.ui.ProcessDialog.static } 展开结果是空对象。
     * 且必须显式标注类型，否则 size 会被推断为 string，与 Size 不兼容。
     */
    public static static: OO.ui.ProcessDialog.Static = {
        ...OO.ui.ProcessDialog.static,
        name: 'usermessages-main',
        title: '向用户发送提醒',
        size: DIALOG_SIZE,
        tagName: 'div',
        escapable: true,
        actions: [
            { action: 'preview', label: '预览', flags: ['primary', 'progressive'] },
            // 没有 action 名：OO.ui.Dialog 会自动关闭对话框
            { label: '取消', flags: ['safe'] },
        ],
    };

    private targetUser = '';
    private config: UserMessagesConfig | null = null;
    private onPreview?: (data: PreviewDialogData) => void;
    private selected: TemplateEntry | null = null;
    private paramFields: ParamField[] = [];
    private customMode = false;
    private loadingCustom = false;

    private loadingPanel!: OO.ui.PanelLayout;
    private formPanel!: OO.ui.PanelLayout;
    private templateDropdown!: OO.ui.DropdownWidget;
    private customCheckbox!: OO.ui.CheckboxInputWidget;
    private customStatus!: OO.ui.LabelWidget;
    private paramFieldset!: OO.ui.FieldsetLayout;
    private customPanel!: OO.ui.PanelLayout;
    private customInput!: OO.ui.MultilineTextInputWidget;
    private summaryInput!: OO.ui.TextInputWidget;

    /**
     * 搭出「加载中」与「表单」两个容器，不碰配置（此时模板列表还未知）。
     */
    public initialize(): this {
        super.initialize();

        this.loadingPanel = new OO.ui.PanelLayout({ padded: true, expanded: false });
        this.loadingPanel.$element.append(
            new OO.ui.ProgressBarWidget({ progress: false }).$element,
            $('<p>').text('正在加载模板列表…'),
        );

        this.formPanel = new OO.ui.PanelLayout({ padded: true, expanded: false, scrollable: true });

        this.$body.append(this.loadingPanel.$element, this.formPanel.$element);
        return this;
    }

    /**
     * 等配置预取落定后把加载态换成表单。
     * 放在 setup 阶段是为了让随后的 updateSize() 按真实表单测量高度。
     */
    public getSetupProcess(data?: OO.ui.Dialog.SetupDataMap & Record<string, unknown>): OO.ui.Process {
        return super.getSetupProcess(data).next(
            asStep<this>(async () => {
                const { targetUser, configPromise, onPreview } = data as unknown as MainDialogData;
                this.targetUser = targetUser;
                this.onPreview = onPreview;
                this.getActions().setAbilities({ preview: false });

                try {
                    const result = await configPromise;
                    if (!result.ok) {
                        this.close({ action: 'configError', message: result.message });
                        return;
                    }
                    this.config = result.config;
                    this.buildForm();
                    this.loadingPanel.$element.detach();
                } catch (error) {
                    // 步骤内绝不能抛：一旦 reject，OOUI 会显示它内置的英文错误界面
                    this.close({
                        action: 'configError',
                        message: error instanceof Error ? error.message : String(error),
                    });
                }
            }),
            this,
        );
    }

    /**
     * 处理底部动作：仅拦截 preview，其余交给父类。
     */
    public getActionProcess(action?: string): OO.ui.Process {
        if (action !== 'preview') {
            return super.getActionProcess(action);
        }
        return new OO.ui.Process(
            asStep<this>(async () => {
                const submission = this.collectSubmission();
                if (!submission) {
                    return;
                }

                this.pushPending();
                let previewHtml: string;
                try {
                    previewHtml = await parseWikitext(submission.submittedText);
                } catch (error) {
                    this.popPending();
                    showError('预览失败', `无法渲染预览：${error instanceof Error ? error.message : String(error)}`);
                    return;
                }
                this.popPending();

                const data: PreviewDialogData = {
                    title: `预览：${submission.templateTitle}`,
                    targetUser: submission.targetUser,
                    previewHtml,
                    submittedText: submission.submittedText,
                    editSummary: submission.editSummary,
                };
                this.onPreview?.(data);
            }),
            this,
        );
    }

    public getBodyHeight(): number {
        return Math.min(this.$body[0]!.scrollHeight, MAX_MAIN_BODY_HEIGHT);
    }

    /**
     * 构建表单。仅在配置就绪后调用一次。
     */
    private buildForm(): void {
        const templates = this.config?.templates ?? [];
        const persisted = loadPersisted();
        const fieldset = new OO.ui.FieldsetLayout({ label: '发送提醒' });

        this.templateDropdown = new OO.ui.DropdownWidget({
            // 未选中时显示的占位文案
            label: '请选择模板',
            // 菜单渲染进窗口 overlay，否则会被窗口 body 的滚动容器裁剪
            $overlay: this.$overlay,
            menu: {
                items: templates.map(entry => new OO.ui.MenuOptionWidget({ data: entry.title, label: entry.title })),
            },
        });
        this.templateDropdown.getMenu().on('select', items => {
            const item = Array.isArray(items) ? items[0] : items;
            if (!item) {
                return;
            }
            const template = this.config ? findTemplate(this.config, String(item.getData())) : undefined;
            if (template) {
                this.applyTemplate(template);
            }
        });
        fieldset.addItems([new OO.ui.FieldLayout(this.templateDropdown, { label: '选择模板', align: 'top' })]);

        fieldset.addItems([
            new OO.ui.FieldLayout(new OO.ui.LabelWidget({ label: this.targetUser }), {
                label: '目标用户',
                align: 'top',
            }),
        ]);

        this.customCheckbox = new OO.ui.CheckboxInputWidget({ selected: false });
        this.customCheckbox.on('change', () => {
            if (this.customCheckbox.isSelected()) {
                void this.loadCustomSource();
                return;
            }
            this.customMode = false;
            this.customPanel.toggle(false);
            this.paramFieldset.toggle(true);
            this.onFormChanged();
            this.updateSize();
        });
        this.customStatus = new OO.ui.LabelWidget({ label: '' });
        fieldset.addItems([
            new OO.ui.FieldLayout(this.customCheckbox, { label: '自定义内容', align: 'inline' }),
            this.customStatus,
        ]);

        this.paramFieldset = new OO.ui.FieldsetLayout();
        fieldset.addItems([this.paramFieldset]);

        this.customInput = new OO.ui.MultilineTextInputWidget({ rows: 8, autosize: true, maxRows: 20 });
        this.customInput.on('change', () => this.onFormChanged());
        this.customPanel = new OO.ui.PanelLayout({ padded: false, expanded: false });
        this.customPanel.$element.append(
            new OO.ui.FieldLayout(this.customInput, { label: '自定义内容', align: 'top' }).$element,
        );
        this.customPanel.toggle(false);
        fieldset.addItems([this.customPanel]);

        this.summaryInput = new OO.ui.TextInputWidget({ value: persisted.editSummary });
        this.summaryInput.on('change', () => savePersisted({ editSummary: this.summaryInput.getValue() }));
        fieldset.addItems([new OO.ui.FieldLayout(this.summaryInput, { label: '编辑摘要', align: 'top' })]);

        this.formPanel.$element.empty().append(fieldset.$element);

        const restored =
            persisted.templateTitle && this.config ? findTemplate(this.config, persisted.templateTitle) : undefined;
        if (restored) {
            this.templateDropdown.getMenu().selectItemByData(restored.title);
            this.applyTemplate(restored);
        } else {
            this.onFormChanged();
        }
    }

    /**
     * 切换到某个模板：重置自定义模式、重建参数区、重新填入摘要。
     * @param template 选中的模板
     */
    private applyTemplate(template: TemplateEntry): void {
        this.selected = template;
        this.customMode = false;
        this.customCheckbox.setSelected(false);
        this.customPanel.toggle(false);
        this.customInput.setValue('');
        this.paramFieldset.toggle(true);

        this.paramFields = (template.parameters ?? []).map(param => createParamField(param, this.$overlay));
        this.paramFieldset.clearItems();
        this.paramFieldset.addItems(this.paramFields.map(field => field.layout));
        for (const field of this.paramFields) {
            field.widget.on('change', () => this.onFormChanged());
        }

        this.summaryInput.setValue(template.summary);
        savePersisted({ templateTitle: template.title, editSummary: template.summary });

        this.onFormChanged();
        // 参数数量变化，且此处已在 setup 之后，没有别的地方会重算框架高度
        this.updateSize();
    }

    /**
     * 按当前模式重算「预览」按钮的可用性，并刷新字段级校验提示。
     */
    private onFormChanged(): void {
        if (this.customMode) {
            this.getActions().setAbilities({ preview: this.customInput.getValue().trim() !== '' });
            return;
        }
        const firstInvalid = validateFields(this.paramFields);
        this.getActions().setAbilities({ preview: this.selected !== null && firstInvalid === null });
    }

    /**
     * 勾选自定义内容后拉取所选中模板的源码。
     * 失败则回退到预置模式（取消勾选并恢复参数表单）。
     */
    private async loadCustomSource(): Promise<void> {
        const template = this.selected;
        if (!template || this.loadingCustom) {
            return;
        }

        this.loadingCustom = true;
        this.customCheckbox.setDisabled(true);
        this.customStatus.setLabel(`正在加载 ${template.template}…`);

        try {
            const source = await fetchPageContentOrThrow(template.template);
            this.customInput.setValue(stripNoInclude(source));
            this.customMode = true;
            this.customPanel.toggle(true);
            this.paramFieldset.toggle(false);
        } catch (error) {
            this.customMode = false;
            this.customCheckbox.setSelected(false);
            this.customPanel.toggle(false);
            this.paramFieldset.toggle(true);
            showError(
                '加载失败',
                `无法加载 ${template.template} 的源代码：${error instanceof Error ? error.message : String(error)}`,
            );
        } finally {
            this.loadingCustom = false;
            this.customCheckbox.setDisabled(false);
            this.customStatus.setLabel('');
            this.onFormChanged();
            this.updateSize();
        }
    }

    /**
     * 汇总当前表单，产出待预览/提交的内容。校验不过时返回 null 并给出提示。
     */
    private collectSubmission(): PreviewSubmission | null {
        if (!this.selected) {
            showError('未选择模板', '请先选择一个提醒模板。');
            return null;
        }

        const raw = this.customMode
            ? this.customInput.getValue().trim()
            : buildPresetWikitext(this.selected, readValues(this.paramFields));
        if (raw === '') {
            showError('内容为空', '待发送的内容不能为空。');
            return null;
        }

        const firstInvalid = this.customMode ? null : validateFields(this.paramFields);
        if (firstInvalid) {
            firstInvalid.widget.focus();
            return null;
        }

        return {
            targetUser: this.targetUser,
            submittedText: buildSubmitText(raw, this.customMode, getSignatureSuffix()),
            editSummary: this.summaryInput.getValue(),
            templateTitle: this.selected.title,
        };
    }
}

export { MainDialog };
