import './modules/styles.scss';
import { edit, editAll, link } from './modules/icon';
import { msg } from './modules/message';

$(() => {
    const { wgIsArticle, wgPageContentModel, wgPageName } = mw.config.get();

    if (!wgIsArticle || wgPageContentModel !== 'wikitext') {
        return;
    }

    const getLinkTitle = (element: Element): string =>
        decodeURI($(element).attr('href')!.substring(1)).replace(/%2F/g, '/');

    const getWikitext = (title: string): Promise<string> => {
        return new Promise(resolve => {
            new mw.Api()
                .get({
                    action: 'parse',
                    page: title,
                    redirects: true,
                    prop: 'wikitext',
                    formatversion: 2,
                })
                .done(data => {
                    resolve(data.parse.wikitext['*']);
                })
                .fail(error => {
                    resolve(error);
                });
        });
    };

    const linksList = (): Record<string, number> => {
        const list = new Map<string, number>();

        document.querySelectorAll<HTMLLinkElement>('.mw-disambig').forEach(element => {
            const title = getLinkTitle(element);
            list.set(title, (list.get(title) || 0) + 1);
        });

        return Object.fromEntries(list);
    };

    $('.mw-disambig').each(function () {
        const title = getLinkTitle(this);
        const displayTitle = $(this).text();
        let titleId = title.split('.').join('');
        const repeat = $(`#${titleId}`).length;
        if (repeat > 0) {
            titleId = titleId + repeat + 1;
        }
        const edit_icon = linksList()[title] === 0 ? edit : editAll;
        const send = (msg: string): void => {
            $(`#${titleId} ul`).empty().append(`<li>${msg}</li>`);
        };

        const $element = $(this);

        $element.after(
            $('<div>', {
                id: titleId,
                class: 'disambig-box',
            })
                .on('mouseleave', () => {
                    $(`#${titleId}`).hide(150, 'swing');
                })
                .append('<ul class="disambig-ul">'),
            $('<sup>').append(
                $('<a>', {
                    href: 'javascript:void(0)',
                    text: '?',
                    class: titleId,
                }),
            ),
        );

        $(`a.${titleId}`).on('mouseenter', async () => {
            $(`#${titleId}`).css({
                left: $(this).position().left + 10,
                top: $(this).position().top + 16,
            });
            send(msg.loading);
            $(`#${titleId}`).show(150, 'swing');

            const senses = await getWikitext(title);
            const senseList = senses
                .split('\n')
                .map(sense => sense.substring(0, sense.indexOf('——')))
                .map(sense => {
                    if (sense.match(/\[\[/g) && !sense.match(/\[\[File:/gi)) {
                        return sense.split('[[')[1]?.split(']]')[0];
                    } else if (sense.match(/\{\{(dis|dl)\|/gi)) {
                        return sense.split(/\{\{(dis|dl)\|/gi)[2];
                    } else if (sense.match(/\{\{coloredlink\|/gi)) {
                        return sense.split(/\{\{coloredlink\|/gi)[2];
                    }
                    return undefined;
                })
                .filter((sense): sense is string => sense !== undefined && sense !== null)
                .map(sense => sense.split('|')[0]);

            $(`#${titleId} ul`).empty();
            if (!senseList[0]) {
                return send(msg.loadingFailed);
            }
            for (const sense of senseList) {
                if (!sense) {
                    return;
                }
                const safeSense = sense.replace(/"/g, '&quot;');
                $(`#${titleId} ul`).append(
                    `<li id="${safeSense}">${sense}<a href="/${safeSense}">${link}</a><a>${edit_icon}</a></li>`,
                );
                document.getElementById(sense)!.lastChild!.addEventListener('click', async () => {
                    send(msg.editing);
                    const wikitext = await getWikitext(wgPageName);
                    let originLink = `[[${title}]]`;
                    if (title !== displayTitle) {
                        originLink = `[[${title}|${displayTitle}]]`;
                    }
                    new mw.Api()
                        .postWithToken('csrf', {
                            action: 'edit',
                            text: wikitext.replaceAll(originLink, `[[${sense}|${displayTitle}]]`),
                            title: wgPageName,
                            minor: true,
                            nocreate: true,
                            summary: `${msg.disambig}：[[${title}]]→[[${sense}]]`,
                            tags: 'Automation tool',
                            errorformat: 'plaintext',
                        })
                        .done(() => {
                            send(msg.edited);
                            window.location.reload();
                        })
                        .fail(error => {
                            send(`${msg.editFailed}（${error}）`);
                        });
                });
            }
        });
    });
});
