const namespaceNumber = mw.config.get("wgNamespaceNumber");
const pageTitle = mw.config.get("wgTitle");
const pageName = mw.config.get("wgPageName");
const userName = mw.config.get("wgUserName");

if (namespaceNumber === 2 && 
    (pageTitle.startsWith(userName + "/") || pageTitle === userName)) {
    $(mw.util.addPortletLink("p-cactions", "#", "清空页面", "clear-userpage", "清空页面", "r")).on("click", function (e) {
        e.preventDefault();

        var dialog = new OO.ui.MessageDialog();
        
        var windowManager = new OO.ui.WindowManager();
        $('body').append(windowManager.$element);
        windowManager.addWindows([dialog]);

        windowManager.openWindow(dialog, {
            title: '确认清空页面',
            message: '您确定要清空当前页面吗？',
            actions: [
                {
                    action: 'confirm',
                    label: '确认',
                    flags: ['primary', 'destructive']
                },
                {
                    action: 'cancel',
                    label: '取消',
                    flags: 'safe'
                }
            ]
        }).closed.then(function (data) {
            if (data && data.action === 'confirm') {
                clearUserPage();
            }
            
            windowManager.destroy();
        });
    });
    
    function clearUserPage() {
        new mw.Api().postWithToken("csrf", {
            format: "json",
            action: "edit",
            watchlist: "nochange",
            tags: "Automation tool",
            title: pageName,
            text: "",
            summary: "清空页面"
        })
        .done(function () {
            mw.notify("清空完毕，即将刷新……", { type: 'success' });
            setTimeout(function () {
                location.reload();
            }, 2000);
        })
        .fail(function (err) {
            var errorMsg = err.error ? err.error.info : err;
            mw.notify("清空页面时出现错误：" + errorMsg, { type: 'error' });
        });
    }
}