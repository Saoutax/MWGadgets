import { consoleSuccess, consoleError } from '@/utils/statusConsole';

const move = async (from: string, to: string) => {
    await new mw.Api()
        .postWithToken('csrf', {
            action: 'move',
            from,
            to,
            reason: '编写完成',
            movetalk: 'noleave',
            noredirect: true,
            tags: 'Automation tool',
        })
        .then(() => {
            consoleSuccess('移动');
        })
        .catch(error => {
            consoleError('DraftToMain', error);
        });
};

export { move };
