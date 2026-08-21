import { isDebugMode, isWakeLockEnabled } from '../models/state';
import { openWindow } from './alertWindow';

/** 日志级别 */
export enum LogSeverity {
    SUCCESS = 'Success',
    INFO = 'Info',
    WARNING = 'Warning',
    ERROR = 'Error',
}

/** 全部日志级别 */
export const ALL_SEVERITIES = [LogSeverity.SUCCESS, LogSeverity.INFO, LogSeverity.WARNING, LogSeverity.ERROR];

/** 日志级别在界面上的中文显示名（内部值保持英文以对应 CSS 类名） */
export const SEVERITY_LABELS: Record<LogSeverity, string> = {
    [LogSeverity.SUCCESS]: '成功',
    [LogSeverity.INFO]: '信息',
    [LogSeverity.WARNING]: '警告',
    [LogSeverity.ERROR]: '错误',
};

/** 单条日志项 */
export class LogEntry {
    public readonly element: JQuery;

    /**
     * @param severity 日志级别
     * @param text 日志文本
     */
    constructor(
        public readonly severity: LogSeverity,
        public readonly text: string,
    ) {
        this.element = this.renderLogLine(severity, text);
    }

    /** 渲染日志级别标签 */
    private formatLogSeverity(severity: LogSeverity): JQuery {
        return $('<span>').text(`[${SEVERITY_LABELS[severity]}]`).addClass(`log-${severity.toLowerCase()}`);
    }

    /** 渲染一整行日志 */
    private renderLogLine(severity: LogSeverity, text: string): JQuery {
        const logElement = $('<div></div>');
        logElement.append(this.formatLogSeverity(severity), $('<span>').text(`: ${text}`));
        return logElement;
    }
}

/**
 * Bot 运行进度窗口：进度条 + 日志面板（可按级别过滤）+ 取消/关闭。
 */
export class ProgressWindow {
    private readonly progressBar: OO.ui.ProgressBarWidget;
    private readonly progressLabel: OO.ui.LabelWidget;
    private readonly logLabel: OO.ui.LabelWidget;
    private readonly cancelButton: OO.ui.ButtonWidget;
    private readonly logPanelWidget: OO.ui.Widget;
    private readonly logEntries: LogEntry[] = [];
    private readonly severityEnabled: Record<LogSeverity, boolean>;
    private readonly logText: JQuery = $('<div></div>');
    private wakeLock: WakeLockSentinel | null = null;
    private progress = 0;
    private isDone = false;
    private isCancelled = false;
    private readonly progressDialog: OO.ui.MessageDialog;

    /**
     * @param total 总任务数
     * @param cancelCallback 用户点击取消时触发的回调
     */
    constructor(
        private readonly total: number,
        private readonly cancelCallback: () => void = () => {},
    ) {
        this.progressBar = new OO.ui.ProgressBarWidget({ progress: 0 });
        this.progressLabel = new OO.ui.LabelWidget({ label: `进度：0 / ${total}` });
        this.logLabel = new OO.ui.LabelWidget({ label: '', classes: ['progress-window-logs'] });

        this.cancelButton = new OO.ui.ButtonWidget({ label: '取消', flags: ['destructive'] });
        this.cancelButton.on('click', () => {
            this.isCancelled = true;
            this.cancelCallback();
            this.hideCancelButton();
            this.addLog(
                LogSeverity.WARNING,
                '已发起取消。注意 Bot 可能还会再执行一次操作后才停止。刷新页面可彻底取消。',
            );
        });

        const progressRow = new OO.ui.Widget({
            content: [this.progressLabel.$element, this.cancelButton.$element],
        });
        progressRow.$element.css({ display: 'flex', justifyContent: 'space-between', alignItems: 'center' });

        this.severityEnabled = Object.fromEntries(ALL_SEVERITIES.map(severity => [severity, true])) as Record<
            LogSeverity,
            boolean
        >;

        const toggleButtons = ALL_SEVERITIES.map(severity => {
            const btn = new OO.ui.ToggleButtonWidget({ label: SEVERITY_LABELS[severity], data: severity, value: true });
            btn.on('change', selected => {
                this.severityEnabled[severity] = selected;
                this.refreshLogs();
            });
            return btn;
        });
        const logFilterButtons = new OO.ui.ButtonGroupWidget({
            items: toggleButtons as unknown as OO.ui.ButtonWidget[],
            classes: ['masstoolkit-log-filter-button-group'],
        });

        this.logPanelWidget = new OO.ui.Widget({ classes: ['masstoolkit-log-panel'] });
        this.logPanelWidget.$element.append(this.logLabel.$element);

        const fieldset = new OO.ui.FieldsetLayout();
        fieldset.addItems([
            new OO.ui.FieldLayout(this.progressBar, { align: 'top' }),
            new OO.ui.FieldLayout(progressRow, { align: 'top' }),
            new OO.ui.FieldLayout(logFilterButtons, { align: 'top', label: '按级别过滤日志' }),
            new OO.ui.FieldLayout(this.logPanelWidget, { align: 'top' }),
        ]);

        this.initialRequestWakeLock();

        this.progressDialog = new OO.ui.MessageDialog();
        openWindow(
            this.progressDialog,
            {
                title: 'Bot 进度',
                message: fieldset.$element,
                actions: [{ action: 'close', label: '关闭', flags: ['neutral'] }],
                size: 'large',
            },
            () => {
                this.cleanupWakeLock();
                if (isDebugMode()) {
                    console.log('masstoolkit: 唤醒锁已清理');
                }
            },
        );

        // 未完成/未取消时关闭需二次确认
        const originalGetActionProcess = this.progressDialog.getActionProcess.bind(this.progressDialog);
        this.progressDialog.getActionProcess = action => {
            if (action === 'close') {
                return new OO.ui.Process(() => {
                    if (this.isDone || this.isCancelled) {
                        this.progressDialog.close();
                    } else {
                        openWindow(
                            new OO.ui.MessageDialog({ size: 'medium' }),
                            {
                                title: '确认退出',
                                message:
                                    'Bot 仍会在后台继续运行。确定要关闭此窗口吗？如需取消 Bot，请点击取消按钮或刷新页面。',
                                actions: [
                                    {
                                        action: 'cancel',
                                        label: '不，返回 Bot 进度界面',
                                        flags: ['neutral', 'safe'],
                                    },
                                    {
                                        action: 'accept',
                                        label: '是，关闭窗口并让 Bot 继续运行',
                                        flags: ['progressive', 'primary'],
                                    },
                                ],
                            },
                            (data: { action: string }) => {
                                if (data.action === 'accept') {
                                    this.progressDialog.close();
                                }
                            },
                        );
                    }
                });
            }
            return originalGetActionProcess(action);
        };
    }

    /**
     * 设置当前进度（达到总数时自动完成）。
     * @param progress 进度值
     */
    setProgress(progress: number): void {
        this.progress = progress;
        const progressPercent = Math.min((progress / this.total) * 100, 100);
        this.progressBar.setProgress(progressPercent);
        this.progressLabel.setLabel(`进度：${progress} / ${this.total}`);
        if (progress >= this.total) {
            this.done();
        }
    }

    /**
     * 增加进度。
     * @param progress 增量
     */
    makeProgress(progress: number): void {
        this.setProgress(this.progress + progress);
    }

    /**
     * 追加日志（受级别过滤开关控制）。
     * @param severity 级别
     * @param text 文本
     */
    addLog(severity: LogSeverity, text: string): void {
        const entry = new LogEntry(severity, text);
        this.logEntries.push(entry);
        if (this.severityEnabled[severity]) {
            this.logText.append(entry.element);
            this.logLabel.setLabel(this.logText);
            this.scrollToBottom();
        }
    }

    /** 隐藏取消按钮（取消或完成时调用） */
    hideCancelButton(): void {
        this.isCancelled = true;
        this.cancelButton.$element.hide();
    }

    /** 标记任务完成 */
    done(): void {
        if (!this.isDone) {
            this.isDone = true;
            this.setProgress(this.total);
            this.hideCancelButton();
            this.cleanupWakeLock();
        }
    }

    /** 按级别过滤开关刷新日志列表 */
    private refreshLogs(): void {
        this.logText.empty();
        for (const entry of this.logEntries) {
            if (this.severityEnabled[entry.severity]) {
                this.logText.append(entry.element);
            }
        }
        this.logLabel.setLabel(this.logText);
    }

    /** 若用户停在底部则跟随滚动到最新日志 */
    private scrollToBottom(): void {
        const panel = this.logPanelWidget.$element[0]!;
        const elementHeight =
            (this.logPanelWidget.$element.scrollTop() ?? 0) + (this.logPanelWidget.$element.innerHeight() ?? 0);
        const scrollThreshold = panel.scrollHeight - 100;
        if (elementHeight >= scrollThreshold) {
            this.logPanelWidget.$element.scrollTop(panel.scrollHeight);
        }
    }

    /** 首次请求唤醒锁 */
    private initialRequestWakeLock(): void {
        if (isWakeLockEnabled() && 'wakeLock' in navigator) {
            document.addEventListener('visibilitychange', this.handleDocumentVisibilityChange);
            this.requestWakeLock();
        }
    }

    /** 请求屏幕唤醒锁 */
    private requestWakeLock(): void {
        navigator.wakeLock
            .request('screen')
            .then((wakeLock: WakeLockSentinel) => {
                this.wakeLock = wakeLock;
                if (isDebugMode()) {
                    this.addLog(LogSeverity.INFO, '已请求唤醒锁');
                }
            })
            .catch((error: { name?: string; message?: string }) => {
                this.addLog(LogSeverity.INFO, `请求唤醒锁失败：${error.name}, ${error.message}`);
            });
    }

    /** 释放唤醒锁 */
    private releaseWakeLock(): void {
        if (this.wakeLock) {
            void this.wakeLock.release().then(() => {
                this.wakeLock = null;
            });
        }
    }

    /** 清理唤醒锁与监听器 */
    private cleanupWakeLock(): void {
        this.releaseWakeLock();
        document.removeEventListener('visibilitychange', this.handleDocumentVisibilityChange);
    }

    /** 页面重新可见时重新请求唤醒锁 */
    private handleDocumentVisibilityChange = async (): Promise<void> => {
        if (this.wakeLock !== null && document.visibilityState === 'visible') {
            this.requestWakeLock();
        }
    };
}
