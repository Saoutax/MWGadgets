import { getSettledConfig, prefetchConfig } from './modules/config';
import {
    ALLOWED_NAMESPACES,
    ALLOWED_SPECIAL_PAGES,
    CONFIG_PAGE,
    DIALOG_SIZE,
    RELOADER_MODULES,
} from './modules/constants';
import { MainDialog } from './modules/mainDialog';
import { showError } from './modules/messageDialog';
import { openWindow } from './modules/openWindow';
import { PreviewDialog } from './modules/previewDialog';
import type { MainDialogData, MainDialogResult, PreviewDialogData } from './modules/types';

(() => {
    const { wgNamespaceNumber, wgCanonicalSpecialPageName, wgRelevantUserName, wgUserName } = mw.config.get();

    if (!ALLOWED_NAMESPACES.includes(wgNamespaceNumber)) {
        return;
    }
    // wgCanonicalSpecialPageName 在非特殊页上是 false（不是 undefined），故用 || 而非 ??
    if (wgNamespaceNumber === -1 && !ALLOWED_SPECIAL_PAGES.includes(wgCanonicalSpecialPageName || '')) {
        return;
    }
    // 目标用户只读，因此取不到时直接不提供入口；
    // 未登录时 assertuser 必然失败，同样不提供。
    if (!wgRelevantUserName || !wgUserName) {
        return;
    }

    // 收窄后取出：下面的闭包里拿不到 wgRelevantUserName 的收窄结果
    const targetUser: string = wgRelevantUserName;

    // 入口处即开始预取，不阻塞渲染；点击时通常已经落定
    const configPromise = prefetchConfig();
    const depsPromise = mw.loader.using(RELOADER_MODULES);

    /** 打开主对话框。 */
    const openDialog = async (): Promise<void> => {
        try {
            await depsPromise;
        } catch (error) {
            // 依赖加载失败时 OO 尚不存在，只能用 mw.notify 兜底。
            // 不用 log.error：它内部对 Error 实例做 JSON.stringify，只会打印出 {}。
            console.error('[UserMessages] 依赖模块加载失败', error);
            mw.notify('界面组件加载失败，请刷新页面后重试。', { type: 'error' });
            return;
        }

        const settled = getSettledConfig();
        if (settled && !settled.ok) {
            showError('无法加载模板列表', describeConfigFailure(settled.message));
            return;
        }

        const mainDialog = new MainDialog({ size: DIALOG_SIZE });
        const data: MainDialogData = {
            targetUser,
            configPromise,
            onPreview: previewData => openPreview(previewData, mainDialog),
        };
        openWindow<MainDialogData, MainDialogResult>(mainDialog, data, result => {
            if (result?.action === 'configError') {
                showError('无法加载模板列表', describeConfigFailure(result.message));
                return;
            }
            if (result?.action === 'formError') {
                showError('界面构建失败', `无法生成表单：${result.message}`);
            }
        });
    };

    /**
     * 在主对话框之上叠开预览对话框；主对话框保持开启。
     * 「返回」（或按 Esc）仅关掉预览，主对话框原样回到前台；发送成功则一并关掉主对话框。
     */
    const openPreview = (data: PreviewDialogData, mainDialog: MainDialog): void => {
        openWindow<PreviewDialogData>(new PreviewDialog({ size: DIALOG_SIZE }), data, result => {
            if (result?.action === 'sent') {
                mainDialog.close();
                mw.notify('已成功发送到讨论页', { type: 'success' });
            }
        });
    };

    /**
     * 拼出配置加载失败的原因说明。
     * @param reason 具体原因
     */
    const describeConfigFailure = (reason: string): string => {
        return `${CONFIG_PAGE} 读取或解析失败：${reason}`;
    };

    // 定义完处理函数再挂入口，避免监听器里出现前向引用
    const portletLink = mw.util.addPortletLink(
        'p-cactions',
        '#',
        '向用户发送提醒',
        'p-usermessages',
        '向该用户发送提醒模板',
    );
    portletLink?.querySelector('a')?.addEventListener('click', event => {
        event.preventDefault();
        void openDialog();
    });
})();
