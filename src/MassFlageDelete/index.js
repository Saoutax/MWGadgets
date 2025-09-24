//<pre> 批量挂删页面工具，逐个挂删，机器人请勿使用。
"use strict";
mw.loader.using(["mediawiki.api", "mediawiki.Title", "ext.gadget.libOOUIDialog"], () => {
    const config = mw.config.get(["wgNamespaceNumber", "wgTitle", "wgUserGroups", "skin", "wgUserName"]);
    const deletedetails = {
        "zh.moegirl.org.cn": { t: "即将删除", s: "[[User:星海子/Gadgets#批量挂删页面|批量挂删]]：" },
        "mzh.moegirl.org.cn": { t: "即将删除", s: "[[User:星海子/Gadgets#批量挂删页面|批量挂删]]：" },
        "commons.moegirl.org.cn": { t: "即将删除", s: "[[zh:User:星海子/Gadgets#批量挂删页面|批量挂删]]：" },
        "en.moegirl.org.cn": { t: "Awaiting deletion", s: "[[zh:User:星海子/Gadgets#批量挂删页面|Batch Flag for Deletion]]：" },
        "ja.moegirl.org.cn": { t: "Sakujo", s: "[[zh:User:星海子/Gadgets#批量挂删页面|複数のページを一括削除]]：" },
        "library.moegirl.org.cn": { t: "即将删除", s: "[[zh:User:星海子/Gadgets#批量挂删页面|批量挂删]]：" },
    };

    function removeBlanks(arr) {
        const ret = [];
        let i, len;
        for (i = 0, len = arr.length; i < len; i++) {
            let s = arr[i];
            s = s.trim();
            if (s) { ret.push(s); }
        }
        return ret;
    }

    function doMassDelete() {
        document.getElementById("wpMassDeleteSubmit").disabled = true;
        let articles = document.getElementById("wpMassDeletePages").value.split("\n");
        articles = removeBlanks(articles);
        if (!articles.length) { return; }
        let RegisterToDelete = 0;
        const
            api = new mw.Api(),
            wpMassDeleteReason = document.getElementById("wpMassDeleteReason").value,
            wpMassDeleteWatch = document.getElementById("wpMassDeleteWatch").value,
            failed = [],
            error = [],
            onSuccess = function () {
                RegisterToDelete++;
                document.getElementById("wpMassDeleteSubmit").value = `(${RegisterToDelete})`;
            };

        function makeDeleteFunc(article) {
            return function () {
                return $.Deferred((deferred) => {
                    if (article.startsWith("cm:")) {
                        article = article.substring(3);
                    }
                    const options = {
                        format: "json",
                        action: "edit",
                        watchlist: wpMassDeleteWatch,
                        title: article,
                        text: `<noinclude>{{${deletedetails[location.hostname].t}|1=${wpMassDeleteReason}|user=${config.wgUserName}}}</noinclude>`,
                        summary: deletedetails[location.hostname].s + wpMassDeleteReason,
                        tags: "Automation tool",
                        nocreate: true,
                        bot: config.wgUserGroups.includes("flood"),
                    };
                    const promise = api.postWithToken("csrf", options);
                    promise.done(onSuccess);
                    promise.fail((_code, obj) => {
                        failed.push(article);
                        error.push(obj.error.info);
                    });
                    promise.always(() => {
                        deferred.resolve();
                    });
                });
            };
        }
        let deferred = makeDeleteFunc(articles[0])();
        for (let i = 1, len = articles.length; i < len; i++) {
            deferred = deferred.then(makeDeleteFunc(articles[i]));
        }

        $.when(deferred).then(() => {
            document.getElementById("wpMassDeleteSubmit").value = `已完成 ${RegisterToDelete} 个挂删`;
            if (failed.length) {
                const $failedList = $("<ul>");
                for (let x = 0; x < failed.length; x++) {
                    const failedTitle = mw.Title.newFromText(failed[x]);
                    const $failedItem = $("<li>");
                    if (failedTitle) {
                        $failedItem.append($("<a>")
                            .attr("href", failedTitle.getUrl())
                            .text(failed[x]),
                        );
                    } else { $failedItem.text(failed[x]); }
                    $failedItem.append(document.createTextNode(`: ${error[x]}`));
                    $failedList.append($failedItem);
                }
                $("#wpMassDeleteFailedContainer")
                    .append($("<br />"))
                    .append($("<b>")
                        .text("挂删失败："),
                    )
                    .append($failedList);
            }
        });
    }

    function MassDeleteForm() {
        const bodyContent = config.skin === "moeskin" ? "moe-body-content" : "bodyContent";
        document.getElementsByTagName("h1")[0].textContent = "Special:批量挂删页面";
        document.title = "批量挂删页面 - 萌娘百科 万物皆可萌的百科全书";
        document.getElementById(bodyContent).innerHTML = "<p>大量挂删页面之工具，请慎用！</p>" +
            '<form id="wpMassDelete" name="wpMassDelete">' +
            "<p>如有滥用之行为，后果请阁下自行承担。</p>" +
            "<p><b>使用方法</b></p>" +
            "<p>1.在挂删列表填写页面，每行一个页面，不需要加[[]]；</p>" +
            "<p>2.添加挂删原因，自行填写或选择预置项均可；</p>" +
            "<p>3.确认无误后点击确认提交；</p>" +
            "<p>4.页面将逐个挂删，按钮的数字将从0增加，请勿关闭本页面;</p>" +
            "<p>5.完成后，按钮文字会显示为完成数量。</p>" +
            '<div id="wpMassDeleteFailedContainer"></div>' +
            "<hr /><br />" +
            "<b>挂删列表</b>：<br />" +
            '<textarea tabindex="1" accesskey="," name="wpMassDeletePages" id="wpMassDeletePages" rows="10" cols="80"></textarea>' +
            '<br /><table style="background-color:transparent">' +
            "<tr><td>监视页面</td>" +
            '<td><select id="wpMassDeleteWatch">' +
            '<option value="preferences">与参数设置同步</option>' +
            '<option value="nochange">不更改</option>' +
            '<option value="watch">加入监视列表</option>' +
            '<option value="unwatch">取消监视</option>' +
            "</select></td></tr>" +
            "<tr><td>挂删原因：</td>" +
            '<td><input type="text" style="width:30em;height:1.5em" id="wpMassDeleteReason" list="MassDeleteReasonList" name="wpMassDeleteReason" maxlength="255" /></td>' +
            '<datalist id="MassDeleteReasonList">' +
            "<option>内容极少/质量极差</option>" +
            "<option>用户本人申请</option>" +
            "<option>错误命名</option>" +
            "<option>移动残留重定向</option>" +
            "<option>无法修复的受损重定向/双重重定向</option>" +
            "<option>不再使用的文件</option>" +
            "<option>文件替换申请</option>" +
            "<option>重复或有更佳版本的文件</option>" +
            "<option>用户页开设维基农场</option>" +
            "<option>违反法律法规或内容管理方针</option>" +
            "</datalist></tr>" +
            '<tr><td><input type="button" id="wpMassDeleteSubmit" name="wpMassDeleteSubmit" value="确认" /></td>' +
            "</form>";
        document.getElementById("wpMassDeleteSubmit").addEventListener("click", async () => {
            const confirm = await oouiDialog.confirm("请确认您的挂删信息是否填写正确！", {
                title: "MassTool",
                size: "small",
            });
            if (confirm) {
                doMassDelete();
            }
        });
    }

    async function massDeleteMaster() {
        if (!config.wgUserGroups.includes("patroller") && !config.wgUserGroups.includes("sysop")) {
            return await oouiDialog.alert("您不是维护人员，禁止使用批量挂删工具！", {
                title: "MassTool",
                size: "small",
            });
        }
        MassDeleteForm();
    }

    if (config.wgNamespaceNumber === -1 &&
        (config.wgTitle.toLowerCase() === "massdelete" || config.wgTitle.toLowerCase() === "md")) {
        massDeleteMaster();
    }

    if (window.MassDelete) {
        mw.util.addPortletLink(
            "p-tb",
            "/Special:MassDelete",
            "批量挂删",
            "t-massdelete",
        );
    }
});
//</pre>
