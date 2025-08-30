$(function () {

  if (!mw.config.get( 'wgIsArticle' ) || mw.config.get( 'wgPageContentModel' ) !== 'wikitext') { return }

  const msg = {
    loading: '加载中...',
    loadingFailed: '( ﾟ∀。)加载失败',
    editing: '修改中...',
    edited: '修改成功！正在刷新页面...',
    editFailed: '( ﾟ∀。)修改失败',
    disambig: '消歧义',
  }
  switch (mw.config.get().wgUserLanguage) {
    case 'zh-hant':
      msg.loading = '加載中...';
      msg.loadingFailed = '( ﾟ∀。)加載失敗';
      msg.editing = '修改中...';
      msg.edited = '修改成功！正在刷新頁面...';
      msg.editFailed = '( ﾟ∀。)修改失敗';
      msg.disambig = '消歧義';
      break;
  }

  const edit = `<img class="icon" alt="edit" src="data:image/svg+xml;base64,PHN2ZyB0PSIxNjMyMTExNDY4NTg2IiBjbGFzcz0iaWNvbiIgdmlld0JveD0iMCAwIDEwMjQgMTAyNCIgdmVyc2lvbj0iMS4xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHAtaWQ9IjMzNTciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIj48cGF0aCBkPSJNODI3LjczMzMzMyAzMTMuMTczMzMzTDcxMC44MjY2NjcgMTk2LjI2NjY2N0E4NS4zMzMzMzMgODUuMzMzMzMzIDAgMCAwIDU5Ny4zMzMzMzMgMTkzLjI4bC0zODQgMzg0YTg1LjMzMzMzMyA4NS4zMzMzMzMgMCAwIDAtMjQuMzIgNTEuNjI2NjY3TDE3MC42NjY2NjcgODA2LjgyNjY2N2E0Mi42NjY2NjcgNDIuNjY2NjY3IDAgMCAwIDEyLjM3MzMzMyAzNC4xMzMzMzNBNDIuNjY2NjY3IDQyLjY2NjY2NyAwIDAgMCAyMTMuMzMzMzMzIDg1My4zMzMzMzNoMy44NGwxNzcuOTItMTYuMjEzMzMzYTg1LjMzMzMzMyA4NS4zMzMzMzMgMCAwIDAgNTEuNjI2NjY3LTI0LjMybDM4NC0zODRhODEuOTIgODEuOTIgMCAwIDAtMi45ODY2NjctMTE1LjYyNjY2N3pNNjgyLjY2NjY2NyA0NTUuNjhMNTY4LjMyIDM0MS4zMzMzMzNsODMuMi04NS4zMzMzMzNMNzY4IDM3Mi40OHoiIHAtaWQ9IjMzNTgiPjwvcGF0aD48L3N2Zz4=">`;
  const edit_all = `<img class="icon" alt="edit_all" src="data:image/svg+xml;base64,PHN2ZyB0PSIxNjMyMTExNDY4NTg2IiBjbGFzcz0iaWNvbiIgdmlld0JveD0iMCAwIDEwMjQgMTAyNCIgdmVyc2lvbj0iMS4xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHAtaWQ9IjMzNTciIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIj48cGF0aCBkPSJNODI3LjczMzMzMyAzMTMuMTczMzMzTDcxMC44MjY2NjcgMTk2LjI2NjY2N0E4NS4zMzMzMzMgODUuMzMzMzMzIDAgMCAwIDU5Ny4zMzMzMzMgMTkzLjI4bC0zODQgMzg0YTg1LjMzMzMzMyA4NS4zMzMzMzMgMCAwIDAtMjQuMzIgNTEuNjI2NjY3TDE3MC42NjY2NjcgODA2LjgyNjY2N2E0Mi42NjY2NjcgNDIuNjY2NjY3IDAgMCAwIDEyLjM3MzMzMyAzNC4xMzMzMzNBNDIuNjY2NjY3IDQyLjY2NjY2NyAwIDAgMCAyMTMuMzMzMzMzIDg1My4zMzMzMzNoMy44NGwxNzcuOTItMTYuMjEzMzMzYTg1LjMzMzMzMyA4NS4zMzMzMzMgMCAwIDAgNTEuNjI2NjY3LTI0LjMybDM4NC0zODRhODEuOTIgODEuOTIgMCAwIDAtMi45ODY2NjctMTE1LjYyNjY2N3pNNjgyLjY2NjY2NyA0NTUuNjhMNTY4LjMyIDM0MS4zMzMzMzNsODMuMi04NS4zMzMzMzNMNzY4IDM3Mi40OHoiIHAtaWQ9IjMzNTgiIGZpbGw9IiNkODFlMDYiPjwvcGF0aD48L3N2Zz4=">`;
  const link = `<img class="icon" alt="link" src="data:image/svg+xml;base64,PHN2ZyB0PSIxNjMyMTExNzE4MDc5IiBjbGFzcz0iaWNvbiIgdmlld0JveD0iMCAwIDEwMjQgMTAyNCIgdmVyc2lvbj0iMS4xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHAtaWQ9IjM1NjgiIHdpZHRoPSIyMDAiIGhlaWdodD0iMjAwIj48cGF0aCBkPSJNMzQxLjMzMzMzMyA1MTJhNDIuNjY2NjY3IDQyLjY2NjY2NyAwIDAgMCA0Mi42NjY2NjcgNDIuNjY2NjY3aDI1NmE0Mi42NjY2NjcgNDIuNjY2NjY3IDAgMCAwIDAtODUuMzMzMzM0SDM4NGE0Mi42NjY2NjcgNDIuNjY2NjY3IDAgMCAwLTQyLjY2NjY2NyA0Mi42NjY2Njd6IiBwLWlkPSIzNTY5Ij48L3BhdGg+PHBhdGggZD0iTTM4NCA2ODIuNjY2NjY3SDMwNy42MjY2NjdBMTc2LjIxMzMzMyAxNzYuMjEzMzMzIDAgMCAxIDEyOCA1MjcuNzg2NjY3IDE3MC42NjY2NjcgMTcwLjY2NjY2NyAwIDAgMSAyOTguNjY2NjY3IDM0MS4zMzMzMzNoODUuMzMzMzMzYTQyLjY2NjY2NyA0Mi42NjY2NjcgMCAwIDAgMC04NS4zMzMzMzNIMzA3LjYyNjY2N2EyNjIuNCAyNjIuNCAwIDAgMC0yNjIuODI2NjY3IDIyMi4yOTMzMzNBMjU2IDI1NiAwIDAgMCAyOTguNjY2NjY3IDc2OGg4NS4zMzMzMzNhNDIuNjY2NjY3IDQyLjY2NjY2NyAwIDAgMCAwLTg1LjMzMzMzM3pNOTgxLjMzMzMzMyA0NzkuNTczMzMzQTI2Mi44MjY2NjcgMjYyLjgyNjY2NyAwIDAgMCA3MTUuMDkzMzMzIDI1NmgtNjQuNDI2NjY2QzYxNi4xMDY2NjcgMjU2IDU5Ny4zMzMzMzMgMjc1LjIgNTk3LjMzMzMzMyAyOTguNjY2NjY3YTQyLjY2NjY2NyA0Mi42NjY2NjcgMCAwIDAgNDIuNjY2NjY3IDQyLjY2NjY2Nmg3Ni4zNzMzMzNBMTc2LjIxMzMzMyAxNzYuMjEzMzMzIDAgMCAxIDg5NiA0OTYuMjEzMzMzIDE3MC42NjY2NjcgMTcwLjY2NjY2NyAwIDAgMSA3MjUuMzMzMzMzIDY4Mi42NjY2NjdoLTg1LjMzMzMzM2E0Mi42NjY2NjcgNDIuNjY2NjY3IDAgMCAwIDAgODUuMzMzMzMzaDg1LjMzMzMzM2EyNTYgMjU2IDAgMCAwIDI1Ni0yODguNDI2NjY3eiIgcC1pZD0iMzU3MCI+PC9wYXRoPjwvc3ZnPg==">`;

  const style = `<style>
    a.mw-disambig.mw-disambig { color: #ff8921; }
    a.mw-disambig.mw-disambig:visited { color: #d2711b; }
    a.mw-redirect.mw-disambig { color: #ff6421; }
    a.mw-redirect.mw-disambig:visited { color: #d2521b; }
    div.disambig-box {
      width: 200px;
      max-height: 220px;
      overflow-y: scroll;
      border-radius: 2px;
      box-shadow: rgba(0, 0, 0, 0.156863) 0px 3px 10px, rgba(0, 0, 0, 0.227451) 0px 3px 10px;
      -webkit-box-shadow: rgba(0, 0, 0, 0.156863) 0px 3px 10px, rgba(0, 0, 0, 0.227451) 0px 3px 10px;
      margin: 0;
      padding: 0;
      color: #000;
      background: #FFF;
      position: absolute;
      font-size: 14px;
      font-style: normal;
      font-weight: normal;
      text-decoration: none;
      text-align: left;
      display: none;
      transition: all 500ms cubic-bezier(.23, 1, .32, 1) 0ms;
      z-index: 999;
    }
    .disambig-box ul.disambig-ul {
      list-style: none;
      padding: 0 !important;
      margin: 0 !important;
    }
    .disambig-box li {
      color: #000 !important;
      padding: 2px 10px;
      transition: all 500ms cubic-bezier(.23, 1, .32, 1) 0ms;
    }
    .disambig-box li:hover { background: #F0F0F0; }
    .disambig-box li a { text-decoration: none; }
    .icon {
      margin-left: 5px;
      width: 20px;
      opacity: .7;
      transition: all 500ms cubic-bezier(.23, 1, .32, 1) 0ms;
    }
    .icon:hover { opacity: 1; }
    </style>`;
  $('body').append(style);

  const getLinkTitle = element => decodeURI($(element).attr('href').substring(1)).replace('%2F', '/')

  const getWikitext = title => {
    return new Promise(resolve => {
      new mw.Api().get({
        action: 'parse',
        page: title,
        redirects: true,
        prop: 'wikitext',
        format: 'json',
      }).done((data) => {
        resolve(data.parse.wikitext['*']);
      }).fail((a, b, errorThrown) => {
        resolve(errorThrown);
      });
    })
  }

  const repeat_num_list = function() {
    let list = {}
    $('.mw-disambig').each(function() {
      const title = getLinkTitle(this);
      list[title] = list[title] + 1 || 0;
    });
    return list
  }();

  $('.mw-disambig').each(async function() {

    const title = getLinkTitle(this); // 链接页面标题
    const display_title = $(this).text(); // 管道符后显示文字
    let id_title = title.split('.').join(''); // 防止消歧义页标题含 .
    let repeat_now = $(`#${id_title}`).length;
    if (repeat_now > 0) { id_title = id_title + repeat_now + 1; } // 同页面出现相同的消歧义链接
    const edit_icon = repeat_num_list[title] === 0 ? edit : edit_all;
    const send = msg => { $(`#${id_title} ul`).empty().append(`<li>${msg}</li>`) }

    $(this).after(
      $('<div>', {
        id: id_title,
        class: 'disambig-box',
      }).on('mouseleave', () => {
        $(`#${id_title}`).hide(150, 'swing');
      }).append('<ul class="disambig-ul">'),
      $('<sup>').append($('<a>', {
        href: 'javascript:void(0)',
        text: '?',
        class: id_title,
      }))
    )

    $(`a.${id_title}`).on('mouseenter', async () => {
      $(`#${id_title}`).css({ // 定位
        'left': $(this).position()['left'] + 10,
        'top': $(this).position()['top'] + 16,
      });
      send(msg.loading);
      $(`#${id_title}`).show(150, 'swing');

      let senses = await getWikitext(title); // 获取义项
      senses = senses.split('\n').map(
        sense => sense.substring(0, sense.indexOf('——'))
      ).map(sense => {
        if (sense.match(/\[\[/g) && !sense.match(/\[\[File:/gi)) {
          return sense.split('[[')[1].split(']]')[0]
        } else if (sense.match(/\{\{(dis|dl)\|/gi)) { // {{dis}}, {{dl}}
          return sense.split(/\{\{(dis|dl)\|/gi)[1]
        } else if (sense.match(/\{\{coloredlink\|/gi)) { // {{coloredlink}}
          return sense.split(/\{\{coloredlink\|/gi)[1]
        }
      }).filter(sense => sense).map(sense => sense.split('|')[0]);

      $(`#${id_title} ul`).empty();
      if (!senses[0]) { return send(msg.loadingFailed) }
      for (const sense of senses) {
        let safe_sense = sense.replace('"', '&quot;');
        $(`#${id_title} ul`).append(`<li id="${safe_sense}">${sense}<a href="/${safe_sense}">${link}</a><a>${edit_icon}</a></li>`);
        document.getElementById(sense).lastChild.addEventListener('click', async () => {
          send(msg.editing);
          let page_title = mw.config.get().wgPageName;
          let wikitext = await getWikitext(page_title);
          let origin_link = `[[${title}]]`;
          if (title !== display_title) {
            origin_link = `[[${title}|${display_title}]]`;
          }
          new mw.Api().postWithToken('csrf', {
            action: 'edit',
            text: wikitext.replaceAll(origin_link, `[[${sense}|${display_title}]]`),
            title: page_title,
            minor: true,
            nocreate: true,
            summary: `${msg.disambig}：[[${title}]]→[[${sense}]]`,
            tags: "Automation tool",
            errorformat: 'plaintext'
          }).done((data) => {
            send(msg.edited);
            window.location.reload();
          }).fail((a, b, errorThrown) => {
            send(`${msg.editFailed}（${errorThrown}）`);
          });
        });
      }
    })

  })

});