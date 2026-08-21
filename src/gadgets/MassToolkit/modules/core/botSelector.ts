import { addTextBot } from '../bots/addText';
import { deleteBot } from '../bots/delete';
import { downloadBot } from '../bots/download';
import { moveBot } from '../bots/move';
import { purgeBot } from '../bots/purge';
import { replaceTextBot } from '../bots/replaceText';
import { openWindow } from '../components/alertWindow';
import { clearCachedPageInfo } from '../models/state';
import { SettingsDialog } from './config';

/** Bot 在列表中所需的最小接口（避免依赖具体泛型参数） */
interface BotHandle {
    description: string;
    options: { rights?: string[] };
    isAvailable(): boolean;
    fetchConfig(): Promise<void>;
}

/** Bot 选择结果（关闭窗口时携带） */
interface BotSelectorResult {
    action: string;
    bot?: BotHandle;
}

/**
 * Bot 选择对话框：列出可用 Bot，点击运行。
 */
class BotSelectorDialog extends OO.ui.ProcessDialog {
    static static = {
        ...OO.ui.ProcessDialog.static,
        name: 'botselector',
        title: 'MassToolkit - 选择 Bot',
        tagName: 'div',
        actions: [
            { action: 'close', label: '关闭', flags: ['safe'] },
            { action: 'settings', label: '设置', flags: ['progressive'] },
        ],
    };

    private mainPanel!: OO.ui.PanelLayout;

    /**
     * @param botList 可用的 Bot 列表
     */
    constructor(private readonly botList: BotHandle[]) {
        super({});
    }

    /**
     * 初始化：列出各 Bot 与其运行按钮。
     */
    public initialize(): this {
        super.initialize();
        this.setupMainPanel();
        this.$body.append(this.mainPanel.$element);
        return this;
    }

    /** 构建 Bot 列表面板 */
    private setupMainPanel(): void {
        this.mainPanel = new OO.ui.PanelLayout({ padded: true, expanded: false });
        const fieldset = new OO.ui.FieldsetLayout({ label: '可用 Bot' });
        for (const bot of this.botList) {
            const isAvailable = bot.isAvailable();
            const runButton = new OO.ui.ButtonWidget({
                label: '运行',
                flags: ['progressive', 'primary'],
                disabled: !isAvailable,
            });
            if (isAvailable) {
                runButton.on('click', () => {
                    this.close({ action: 'run', bot } satisfies BotSelectorResult);
                });
            }
            const botLayout = new OO.ui.FieldLayout(runButton, {
                label: bot.description,
                align: 'inline',
                help: isAvailable ? undefined : `需要权限：${bot.options.rights?.join(', ')}`,
            });
            fieldset.addItems([botLayout]);
        }
        this.mainPanel.$element.append(fieldset.$element);
    }

    /**
     * 处理动作。
     * @param action 动作名
     */
    public getActionProcess(action: string): OO.ui.Process {
        if (action === 'settings') {
            return new OO.ui.Process(() => {
                openWindow(new SettingsDialog());
            });
        }
        if (action === 'close') {
            return new OO.ui.Process(() => {
                this.close({ action: 'close' } satisfies BotSelectorResult);
            });
        }
        return super.getActionProcess(action);
    }
}

/**
 * 打开 Bot 选择器；选中后清空页面缓存并进入配置流程。
 */
export function runBotSelector(): void {
    const allBots: BotHandle[] = [replaceTextBot, purgeBot, deleteBot, addTextBot, downloadBot, moveBot];
    openWindow<BotSelectorResult>(new BotSelectorDialog(allBots), {}, result => {
        if (result && result.action === 'run' && result.bot) {
            clearCachedPageInfo();
            void result.bot.fetchConfig();
        }
    });
}
