import { API } from '../api/mwApi';
import { fetchFileUrl } from '../api/pageInfo';
import { simpleAlert } from '../components/alertWindow';
import { InputType } from '../components/inputDialog';
import { LogSeverity } from '../components/progressWindow';
import { Bot, BotConfigurationDialog } from '../core/bot';
import type { PageInfo } from '../models/page';

interface DownloadOptions {
    pages: string[];
    downloadThrottle: number;
}

/**
 * 通过 Blob 对象触发浏览器下载。
 * @param url 文件直链
 * @param filename 保存文件名
 */
async function downloadFile(url: string, filename: string): Promise<boolean> {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            console.error(`Failed to fetch: ${response.status} ${response.statusText}`);
            return false;
        }
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = objectUrl;
        a.download = filename;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objectUrl);
        return true;
    } catch (error) {
        console.error('Download failed', error);
        return false;
    }
}

/** 批量下载文件页面对应的文件 */
export const downloadBot: Bot<DownloadOptions> = new Bot({
    name: 'DownloadBot',
    description: '批量下载文件',
    batchSize: 1,
    /** 预取每批文件页面的直链地址。 */
    preprocessPages: pages => fetchFileUrl(pages),
    /** 处理单批页面：触发文件下载。 */
    processBatch: async (pages: PageInfo[], options: DownloadOptions) => {
        const page = pages[0];
        if (!page) {
            return { severity: LogSeverity.ERROR, message: '没有可处理的页面' };
        }
        const url = page.fileUrl;
        if (!url) {
            return {
                severity: LogSeverity.ERROR,
                message: `页面 ${page.title} 没有有效的直链地址，请确认它是文件页面。`,
            };
        }
        await API.throttle('download', options.downloadThrottle);
        const success = await downloadFile(url, page.titleWithoutNs());
        return success
            ? { severity: LogSeverity.SUCCESS, message: `${page.title} 已下载` }
            : { severity: LogSeverity.ERROR, message: `下载 ${page.title} 失败` };
    },
    /** 构造"下载"配置对话框。 */
    createConfigDialog: () =>
        new BotConfigurationDialog({
            inputOptions: [
                {
                    key: 'downloadThrottle',
                    label: '下载节流（秒）',
                    type: InputType.NUMBER,
                    defaultValue: 1,
                    min: 0,
                    help: '两次下载之间等待的时间，避免给服务器造成负担',
                },
            ],
            /** 校验：下载节流必须为非负数。 */
            validator: (data: DownloadOptions) => {
                if (data.downloadThrottle < 0) {
                    simpleAlert('输入无效', '下载节流必须为非负数');
                    return false;
                }
                return true;
            },
        }),
});
