import { DIALOG_SIZE, MAX_PREVIEW_BODY_HEIGHT } from './constants';
import { confirmRetry, showError } from './messageDialog';
import { asStep } from './process';
import { sendEdit, type SendParams } from './send';
import type { PreviewDialogData } from './types';

/**
 * 预览对话框：展示 action=parse 渲染出的 HTML，可折叠查看待提交正文，并执行发送。
 *
 * 发送失败时本对话框保持开启、输入原样保留，「重试」直接在同一流程内重新提交。
 */
export class PreviewDialog extends OO.ui.ProcessDialog {
    // 见 MainDialog 中关于 static 必须写全的说明
    public static static: OO.ui.ProcessDialog.Static = {
        ...OO.ui.ProcessDialog.static,
        name: 'usermessages-preview',
        title: '预览',
        size: DIALOG_SIZE,
        tagName: 'div',
        escapable: true,
        actions: [
            { action: 'send', label: '发送提醒', flags: ['primary', 'progressive'] },
            { action: 'close', label: '关闭', flags: ['safe'] },
        ],
    };

    private sendParams: SendParams | null = null;
    private sending = false;

    private htmlPanel!: OO.ui.PanelLayout;
    private contentPanel!: OO.ui.PanelLayout;
    private wikitextToggle!: OO.ui.ToggleButtonWidget;
    private wikitextInput!: OO.ui.MultilineTextInputWidget;
    private wikitextLayout!: OO.ui.FieldLayout<OO.ui.MultilineTextInputWidget>;

    /**
     * 搭出预览区与可折叠的 wikitext 区。
     */
    public initialize(): this {
        super.initialize();

        this.htmlPanel = new OO.ui.PanelLayout({ padded: true, expanded: false });

        this.wikitextInput = new OO.ui.MultilineTextInputWidget({
            value: '',
            readOnly: true,
            rows: 8,
            autosize: true,
            maxRows: 16,
        });
        this.wikitextLayout = new OO.ui.FieldLayout(this.wikitextInput, {
            label: '待提交的 wikitext',
            align: 'top',
        });
        this.wikitextToggle = new OO.ui.ToggleButtonWidget({ label: '显示待提交的 wikitext', value: false });
        this.wikitextToggle.on('change', () => {
            this.wikitextLayout.toggle(this.wikitextToggle.getValue());
            // 折叠区展开会改变内容高度，需要重算框架尺寸
            this.updateSize();
        });

        this.contentPanel = new OO.ui.PanelLayout({ padded: false, expanded: false, scrollable: true });
        this.contentPanel.$element.append(
            this.htmlPanel.$element,
            this.wikitextToggle.$element,
            this.wikitextLayout.$element,
        );
        this.$body.append(this.contentPanel.$element);
        return this;
    }

    /**
     * 从打开数据里取出渲染结果与待提交正文。
     * 标题随模板变化，因此通过打开数据的 title 覆写静态标题。
     */
    public getSetupProcess(data?: OO.ui.Dialog.SetupDataMap & Record<string, unknown>): OO.ui.Process {
        return super.getSetupProcess(data).next(() => {
            const payload = data as unknown as PreviewDialogData;
            this.htmlPanel.$element.html(payload.previewHtml);
            this.wikitextInput.setValue(payload.submittedText);
            this.wikitextToggle.setValue(false);
            this.wikitextLayout.toggle(false);
            this.sendParams = {
                targetUser: payload.targetUser,
                text: payload.submittedText,
                summary: payload.editSummary,
            };
        }, this);
    }

    /**
     * 内容已插入可见 DOM 后再触发 wikipage.content，
     * 让 <gallery>、折叠元素等依赖 JS 初始化的内容在预览里也能正常工作。
     */
    public getReadyProcess(data?: OO.ui.Dialog.SetupDataMap & Record<string, unknown>): OO.ui.Process {
        return super.getReadyProcess(data).next(() => {
            mw.hook('wikipage.content').fire(this.htmlPanel.$element);
        }, this);
    }

    /**
     * 处理底部动作。
     */
    public getActionProcess(action?: string): OO.ui.Process {
        if (action === 'close') {
            return new OO.ui.Process(() => {
                this.close({ action: 'close' });
            }, this);
        }
        if (action !== 'send') {
            return super.getActionProcess(action);
        }
        return new OO.ui.Process(
            asStep<this>(async () => {
                if (this.sending || !this.sendParams) {
                    return;
                }
                this.setSending(true);
                try {
                    for (;;) {
                        const result = await sendEdit(this.sendParams);
                        if (result.ok) {
                            // 对话框即将关闭，无需恢复按钮状态
                            this.close({ action: 'sent' });
                            return;
                        }
                        if ((await confirmRetry('发送失败', result.detail)) !== 'retry') {
                            this.setSending(false);
                            return;
                        }
                    }
                } catch (error) {
                    // 步骤内绝不能抛：一旦 reject，OOUI 会显示它内置的英文错误界面
                    this.setSending(false);
                    showError('发送失败', error instanceof Error ? error.message : String(error));
                }
            }),
            this,
        );
    }

    /**
     * 内容区最高不超过 MAX_PREVIEW_BODY_HEIGHT。
     */
    public getBodyHeight(): number {
        return Math.min(this.$body[0]!.scrollHeight, MAX_PREVIEW_BODY_HEIGHT);
    }

    /**
     * 发送中禁用两个按钮并改文案，防止重复投递。
     * @param sending 是否正在发送
     */
    private setSending(sending: boolean): void {
        this.sending = sending;
        this.getActions().setAbilities({ send: !sending, close: !sending });
        this.getActions()
            .get({ actions: 'send' })[0]
            ?.setLabel(sending ? '发送中…' : '发送提醒');
    }
}
