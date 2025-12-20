$(function () {
    function undo(pageid, undoid, undoafter, ignoreabusefilter = true) {
        new mw.Api().getToken('csrf').then(function(token) {
            ajaxdata = {
                "action": "edit",
                "format": "json",
                "pageid": pageid,
                "summary": '// QuickUndo',
                "undo": undoid,
                "token": token,
            };
            if (undoafter) ajaxdata.undoafter = undoafter;
            mw.notify('正在操作');
            $.ajax({
                type: "POST",
                url: '/api.php',
                data: ajaxdata,
                success: function (data) {
                    if (data.edit && data.edit.result == 'Success') {
                        if (data.edit.nochange != undefined) {
                            mw.notify('这次编辑似乎已被撤销。');
                        } else {
                            mw.notify('完成');
                            setTimeout(function () { window.open('/Special:Diff/' + data.edit.newrevid); }, 0);
                        }
                    } else if (data.edit && data.edit.result == 'Failure' && data.edit.abusefilter && data.edit.abusefilter.actions.indexOf('warn') != -1 && ignoreabusefilter) {
                        mw.notify('遇到过滤器' + data.edit.abusefilter.id + '（' + data.edit.abusefilter.description + '），忽略警告');
                        setTimeout(function () { undo(pageid, undoid, undoafter, false) }, 0);
                    } else if (data.error && data.error.info == 'The edit could not be undone due to conflicting intermediate edits.') {
                        mw.notify('因存在冲突的中间编辑，本编辑不能撤销。');
                    } else {
                        mw.notify('出现未知错误，以下是错误信息:'
                            + JSON.stringify(data));
                        console.log(JSON.stringify(data))
                    }
                },
                error: function () {
                    mw.notify('网络连接出错');
                }
            });
        }).catch(function() {
            mw.notify('获取编辑令牌失败');
        });
    }
    if (mw.config.values.wgDiffNewId || mw.config.values.wgDiffOldId) {
        $('.mw-diff-undo').each(function () {
            this.innerHTML = this.innerHTML.replace(/）$/, '/<a href="#." title = "无需确定并忽略过滤器警告" class="quickundo_diff">快速撤销</a >）')
        });
        $('a.quickundo_diff').each(function () {
            this.onclick = function () {
                undo(mw.config.values.wgArticleId, mw.config.values.wgDiffNewId, mw.config.values.wgDiffOldId);
            }
        });
    }
    if (mw.config.values.wgAction == 'history') {
        $('.mw-history-undo').append('/<a href="#." title = "无需确定并忽略过滤器警告" class="quickundo_history">快速撤销</a >');
        $('a.quickundo_history').each(function () {
            this.onclick = function () {
                var href = $(this).parents('span.mw-history-undo').children('a:not(.quickundo_history)')[0].href;
                var undoid = href.match(/undo=(\d+)/)[1];
                var undoafter = href.match(/undoafter=(\d+)/)[1];
                undo(mw.config.values.wgArticleId, undoid, undoafter);
            }
        });

        var last_user = $('.history-user:first .mw-userlink:first')[0].href;
        var undoafter = -1;
        var times = 0;
        $.each($('.history-user .mw-userlink'), function () {
            if (this.href != last_user) {
                undoafter = $(this).parents('li')[0].dataset.mwRevid;
                return false;
            } else {
                times++;
            }
        });
        var rollback = document.createElement('a');
        rollback.innerText = '回退' + times + '次的编辑';
        rollback.href = '#.';
        rollback.onclick = function () {
            undo(mw.config.values.wgArticleId, mw.config.values.wgCurRevisionId, undoafter);
        }
        $('#pagehistory li:first').append('[').append(rollback).append(']')
    }
    window.QuickDiffExtension = window.QuickDiffExtension || [];
    window.QuickDiffExtension.push(function (that, data) {
        $(that).find('#quick-diff-content').prepend('<input class="quick-undo-quick-diff" title="无需确定并忽略过滤器警告" type="submit" value="快速撤销此编辑">');
        $(that).find('input.quick-undo-quick-diff').each(function () {
            this.onclick = function () {
                undo(data.compare.fromid, data.compare.fromrevid, data.compare.torevid);
            }
        });
    });
});