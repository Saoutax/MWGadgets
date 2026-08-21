import { runBotSelector } from './modules/core/botSelector';
import { loadConfig } from './modules/core/config';
import { getAllNamespacesAsync } from './modules/models/namespace';
import { fetchAllUserGroups } from './modules/models/userGroup';
import { fetchUserRights } from './modules/models/userRight';
import './modules/styles/masstoolkit.scss';

(() => {
    const link = mw.util.addPortletLink('p-tb', '#', 'MassToolkit', 'toolbar-masstoolkit');
    link?.addEventListener('click', async (event: MouseEvent) => {
        event.preventDefault();
        loadConfig();
        await Promise.all([getAllNamespacesAsync(), fetchUserRights(), fetchAllUserGroups()]);
        runBotSelector();
    });
})();
