$(() => {
    mw.util.addPortlet('p-talkboard', '讨论版', '#p-help');
    [
        '操作申请',
        '页面相关',
        '提问求助',
        '技术实现',
        '权限变更',
        '方针政策',
        '群组信息'
    ].forEach(text => {
        const id = `p-${text}`;
        mw.util.addPortletLink('p-talkboard', `/萌娘百科 talk:讨论版/${text}`, text, id);
    });
    document.querySelector('#n-sidebar-discussionboard').style.display = 'none';
});