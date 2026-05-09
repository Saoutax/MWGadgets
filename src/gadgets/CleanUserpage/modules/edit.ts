import { consoleSuccess, consoleError } from '@/utils/statusConsole';

const { wgPageName } = mw.config.get();

const edit = async () => {
    await new mw.Api()
        .postWithToken('csrf', {
            action: 'edit',
            title: wgPageName,
            text: '',
            summary: '清空页面',
            tags: 'Automation tool',
        })
        .then(() => {
            consoleSuccess('清理');
        })
        .catch(error => {
            consoleError('CleanPreload', error);
        });
};

export { edit };
