import { consoleSuccess, consoleError } from '@/utils';

const api = new mw.Api(),
    { wgPageName } = mw.config.get();

const create = async (template: string, content: string = '') => {
    const text = content ? `{{${template}|${content}}}` : `{{${template}}}`;
    try {
        await api.postWithToken('csrf', {
            action: 'edit',
            text,
            title: wgPageName,
            summary: '快速创建分类页',
            tags: 'Automation tool',
        });
        consoleSuccess('创建');
    } catch (err) {
        consoleError('QuickNewCat', err);
    }
};

const work = async () => {
    await create('作品');
};

const character = async () => {
    await create('作品中角色');
};

const music = async () => {
    await create('作品中音乐');
};

const vup = async () => {
    await create('虚拟角色/虚拟UP主');
};

const charainwork = async (content: string) => {
    await create('虚拟角色/作', content);
};

const real = async (content: string) => {
    await create('现实人物', content);
};

const author = async (content: string) => {
    await create('作者分类', content);
};

export { work, character, music, vup, charainwork, real, author };
