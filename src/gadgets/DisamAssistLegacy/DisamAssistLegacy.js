'use strict';
$(() => {
    const { wgArticlePath, wgScript, wgPageName, wgAction, wgCategories } = mw.config.get();
    const api = new mw.Api();

    let cfg = {};
    let txt = {};
    let startLink, ui;
    let links, pageChanges;
    let currentPageTitle, currentPageParameters, currentLink;
    let possibleBacklinkDestinations;
    let forceSamePage = false;
    let running = false;
    let choosing = false;
    let displayedPages = {};
    let pageCache = {};
    let prefetchInProgress = false;
    let editCount = 0;
    let editLimit;
    const pendingSaves = [];
    let pendingEditBox = null;
    let pendingEditBoxText;
    let lastEditMillis = 0;
    let runningSaves = false;

    /**
     * 入口函数：检查当前页面是否为消歧义页面，并添加工具启动链接。
     */
    const install = () => {
        cfg = window.DisamAssist.cfg;
        txt = window.DisamAssist.txt;
        if (wgAction === 'view' && wgCategories.includes('消歧义页')) {
            // TODO: 此处应移动到 Gadgets-definition 定义
            mw.loader.using(['mediawiki.Title', 'mediawiki.api'], () => {
                if (wgPageName.endsWith('(消歧义页)')) {
                    const startMainLink = $(
                        mw.util.addPortletLink('p-cactions', '#', txt.startMain, 'ca-disamassist-main'),
                    ).click(startMain);
                    const startSameLink = $(
                        mw.util.addPortletLink('p-cactions', '#', txt.startSame, 'ca-disamassist-same'),
                    ).click(startSame);
                    startLink = startMainLink.add(startSameLink);
                } else {
                    startLink = $(mw.util.addPortletLink('p-cactions', '#', txt.start, 'ca-disamassist-page')).click(
                        start,
                    );
                }
            });
        }
    };

    /**
     * 启动工具，显示界面并开始查找需要修复的链接。
     */
    const start = () => {
        if (!running) {
            running = true;
            links = [];
            pageChanges = [];
            displayedPages = {};
            pageCache = {};
            prefetchInProgress = false;
            createUI();
            addUnloadConfirm();
            markDisamOptions();
            checkEditLimit().then(() => {
                togglePendingEditBox(false);
                doPage();
            });
        }
    };

    /**
     * 启动 DisamAssist，将指向当前页面的入链进行消歧义处理，不考虑页面标题。
     */
    const startSame = () => {
        forceSamePage = true;
        start();
    };

    /**
     * 启动 DisamAssist：如果页面标题以“ (disambiguation)”结尾，则处理指向主题条目的链接；否则处理指向当前页面的链接。
     */
    const startMain = () => {
        forceSamePage = false;
        start();
    };

    /**
     * 创建并显示用户界面。
     */
    const createUI = () => {
        ui = {
            display: $('<div></div>').addClass('disamassist-box disamassist-mainbox'),
            finishedMessage: $('<div></div>').text(txt.noMoreLinks).hide(),
            pageTitleLine: $('<span></span>').addClass('disamassist-pagetitleline'),
            pendingEditCounter: $('<div></div>').addClass('disamassist-editcounter'),
            context: $('<span></span>').addClass('disamassist-context'),
            undoButton: createButton(txt.undo, undo),
            omitButton: createButton(txt.omit, omit),
            endButton: createButton(txt.close, saveAndEnd),
            refreshButton: createButton(txt.refresh, refresh),
            titleAsTextButton: createButton(txt.titleAsText, chooseTitleFromPrompt),
            removeLinkButton: createButton(txt.removeLink, chooseLinkRemoval),
        };
        const top = $('<div></div>')
            .addClass('disamassist-top')
            .append([ui.pendingEditCounter, ui.finishedMessage, ui.pageTitleLine]);
        const leftButtons = $('<div></div>')
            .addClass('disamassist-leftbuttons')
            .append([ui.titleAsTextButton, ui.removeLinkButton, ui.omitButton]);
        const rightButtons = $('<div></div>')
            .addClass('disamassist-rightbuttons')
            .append([ui.undoButton, ui.refreshButton, ui.endButton]);
        const allButtons = $('<div></div>').addClass('disamassist-allbuttons').append([leftButtons, rightButtons]);
        ui.display.append([top, ui.context, allButtons]);
        updateEditCounter();
        toggleActionButtons(false);
        // Insert the UI in the page
        $('#mw-content-text').before(ui.display);
        ui.display.hide().fadeIn();
    };

    /**
     * 关闭页面前，如果存在待处理的更改则显示确认提示。
     */
    const addUnloadConfirm = () => {
        $(window).on('beforeunload', () => {
            if (running && checkActualChanges()) {
                return txt.pending;
            } else if (editCount !== 0) {
                return txt.editInProgress;
            }
        });
    };

    /**
     * 标记消歧义页面中的候选条目。
     */
    const markDisamOptions = () => {
        const optionPageTitles = [];
        const optionMarkers = [];
        getDisamOptions().each(function () {
            const link = $(this);
            const title = extractPageName(link);
            const optionMarker = $('<a></a>')
                .attr('href', '#')
                .addClass('disamassist-optionmarker')
                .text(txt.optionMarker)
                .click(ev => {
                    ev.preventDefault();
                    chooseReplacement(title);
                });
            link.after(optionMarker);
            optionMarkers.push(optionMarker);
            optionPageTitles.push(title);
        });
        // Now check the disambiguation options and display a different message for those that are
        // actually the same as the target page where the links go, as choosing those options doesn't really
        // accomplish anything (except bypassing redirects, which might be useful in some cases)
        const targetPage = getTargetPage();
        fetchRedirects(optionPageTitles.concat(targetPage))
            .done(redirects => {
                const endTargetPage = resolveRedirect(targetPage, redirects);
                for (let ii = 0; ii < optionPageTitles.length; ii++) {
                    const endOptionTitle = resolveRedirect(optionPageTitles[ii], redirects);
                    if (isSamePage(optionPageTitles[ii], targetPage)) {
                        optionMarkers[ii].text(txt.targetOptionMarker).addClass('disamassist-curroptionmarker');
                    } else if (isSamePage(endOptionTitle, endTargetPage)) {
                        optionMarkers[ii].text(txt.redirectOptionMarker).addClass('disamassist-curroptionmarker');
                    }
                }
            })
            .fail(error);
    };

    /**
     * 检查编辑冷却时间是否生效，并据此设置编辑限制。
     * @returns {jQuery.Promise} 表示检查完成的 jQuery Promise。
     */
    const checkEditLimit = () => {
        const dfd = new $.Deferred();
        if (cfg.editCooldown <= 0) {
            editLimit = false;
            dfd.resolve();
        } else {
            fetchRights()
                .done(rights => {
                    editLimit = $.inArray('bot', rights) === -1;
                })
                .fail(description => {
                    error(description);
                    editLimit = true;
                })
                .always(() => {
                    dfd.resolve();
                });
        }
        return dfd.promise();
    };

    /**
     * 查找单个来源页面中指向消歧义页面的所有入链，并逐一请求用户处理。
     */
    const doPage = () => {
        if (pageChanges.length > cfg.historySize) {
            applyChange(pageChanges.shift());
        }
        if (links.length === 0) {
            const targetPage = getTargetPage();
            getBacklinks(targetPage)
                .done((backlinks, pageTitles) => {
                    const pending = {};
                    $.each(pendingSaves, function () {
                        pending[this[0]] = true;
                    });
                    const baseDestinations = [targetPage];
                    $.each(pageTitles, (_, t) => {
                        if (t != targetPage && removeDisam(t) != targetPage) {
                            baseDestinations.push(t);
                        }
                    });
                    possibleBacklinkDestinations = baseDestinations;
                    buildVariantLookupTable(baseDestinations, () => {
                        links = $.grep(backlinks, el => {
                            return !displayedPages[el] && !pending[el];
                        });
                        if (links.length === 0) {
                            updateContext();
                        } else {
                            prefetchNextBatch(() => {
                                doPage();
                            });
                        }
                    });
                })
                .fail(error);
        } else {
            currentPageTitle = links.shift();
            displayedPages[currentPageTitle] = true;
            toggleActionButtons(false);

            const cachedPage = pageCache[currentPageTitle];
            if (cachedPage) {
                delete pageCache[currentPageTitle];
                currentPageParameters = cachedPage;
                currentLink = null;

                const cacheSize = Object.keys(pageCache).length;
                if (cacheSize <= 1 && links.length > 0) {
                    prefetchNextBatch();
                }

                doLink();
            } else {
                // Cache miss: 如果预取正在进行中，只加载当前页面，避免重复请求
                if (prefetchInProgress) {
                    loadPage(currentPageTitle)
                        .done(result => {
                            currentPageParameters = result;
                            currentLink = null;
                            doLink();
                        })
                        .fail(error);
                } else {
                    // 预取未在运行，批量加载当前页面 + 剩余未缓存的页面
                    const batchTitles = [currentPageTitle];
                    for (let i = 0; i < links.length && batchTitles.length < cfg.queryTitleLimit; i++) {
                        if (!Object.hasOwn(pageCache, links[i])) {
                            batchTitles.push(links[i]);
                        }
                    }
                    loadPagesBatch(batchTitles)
                        .done(results => {
                            $.extend(pageCache, results);
                            // 从缓存中取出当前页面，确保只消费一次
                            delete pageCache[currentPageTitle];
                            currentPageParameters = results[currentPageTitle];
                            currentLink = null;
                            doLink();
                        })
                        .fail(error);
                }
            }
        }
    };

    /**
     * 查找并请求用户处理单个来源页面中的一条入链。
     */
    const doLink = () => {
        currentLink = extractLinkToPage(
            currentPageParameters.content,
            possibleBacklinkDestinations,
            currentLink ? currentLink.end : 0,
        );
        if (currentLink) {
            updateContext();
        } else {
            doPage();
        }
    };

    /**
     * 将当前链接的目标替换为新的页面。
     * @param {?string} pageTitle 新的链接目标。
     * @param {string} [extra] 链接后追加的文本。
     * @param {string} [summary] 编辑摘要。
     */
    const chooseReplacement = (pageTitle, extra, summary) => {
        if (choosing) {
            choosing = false;
            if (!summary) {
                if (pageTitle) {
                    summary = txt.summaryChanged.replace('$1', pageTitle);
                } else {
                    summary = txt.summaryOmitted;
                }
            }
            addChange(currentPageTitle, currentPageParameters, currentPageParameters.content, currentLink, summary);
            if (pageTitle && (pageTitle !== getTargetPage() || extra)) {
                currentPageParameters.content = replaceLink(
                    currentPageParameters.content,
                    pageTitle,
                    currentLink,
                    extra || '',
                    currentPageParameters.redirect,
                );
            }
            doLink();
        }
    };

    /**
     * 请求用户输入替代链接目标，并将其用于替换。
     */
    const chooseTitleFromPrompt = () => {
        const title = prompt(txt.titleAsTextPrompt);
        if (title !== null) {
            chooseReplacement(title);
        }
    };

    /**
     * 移除当前链接，但保留链接显示文本。
     */
    const chooseLinkRemoval = () => {
        if (choosing) {
            const summary = txt.summaryRemoved;
            addChange(currentPageTitle, currentPageParameters, currentPageParameters.content, currentLink, summary);
            currentPageParameters.content = removeLink(currentPageParameters.content, currentLink);
            doLink();
        }
    };

    /**
     * 撤销最近一次更改。
     */
    const undo = () => {
        if (pageChanges.length !== 0) {
            const lastPage = pageChanges[pageChanges.length - 1];
            if (currentPageTitle !== lastPage.title) {
                links.unshift(currentPageTitle);
                currentPageTitle = lastPage.title;
            }
            currentPageParameters = lastPage.page;
            currentPageParameters.content = lastPage.contentBefore.pop();
            currentLink = lastPage.links.pop();
            lastPage.summary.pop();
            if (lastPage.contentBefore.length === 0) {
                pageChanges.pop();
            }
            updateContext();
        }
    };

    /**
     * 跳过当前链接，不产生更改。
     */
    const omit = () => {
        chooseReplacement(null);
    };

    /**
     * 保存所有待处理的更改，然后重新启动工具。
     */
    const refresh = () => {
        saveAndEnd();
        start();
    };

    /**
     * 启用或禁用页面操作及当前链接操作按钮。
     * @param {boolean} enabled 是否启用按钮。
     */
    const toggleActionButtons = enabled => {
        const affectedButtons = [ui.omitButton, ui.titleAsTextButton, ui.removeLinkButton, ui.undoButton];
        $.each(affectedButtons, (_, button) => {
            button.prop('disabled', !enabled);
        });
    };

    /**
     * 显示或隐藏“没有更多链接”提示。
     * @param {boolean} show 是否显示提示。
     */
    const toggleFinishedMessage = show => {
        toggleActionButtons(!show);
        ui.undoButton.prop('disabled', pageChanges.length === 0);
        ui.finishedMessage.toggle(show);
        ui.pageTitleLine.toggle(!show);
        ui.context.toggle(!show);
    };

    /**
     * 显示或隐藏待编辑提示框。
     * @param {boolean} show 是否显示提示框。
     */
    const togglePendingEditBox = show => {
        if (pendingEditBox === null) {
            pendingEditBox = $('<div></div>').addClass('disamassist-box disamassist-pendingeditbox');
            pendingEditBoxText = $('<div></div>');
            pendingEditBox.append(pendingEditBoxText).hide();
            if (editLimit) {
                pendingEditBox.append(
                    $('<div></div>').text(txt.pendingEditBoxLimited).addClass('disamassist-subtitle'),
                );
            }
            $('#mw-content-text').before(pendingEditBox);
            updateEditCounter();
        }
        if (show) {
            pendingEditBox.fadeIn();
        } else {
            pendingEditBox.fadeOut();
        }
    };

    const notifyCompletion = () => {
        const oldTitle = document.title;
        document.title = txt.notifyCharacter + document.title;
        $(document.body).one('mousemove', () => {
            document.title = oldTitle;
        });
    };

    /**
     * 更新当前链接及其上下文的显示内容。
     */
    const updateContext = () => {
        updateEditCounter();
        if (!currentLink) {
            toggleFinishedMessage(true);
        } else {
            ui.pageTitleLine.html(
                txt.pageTitleLine
                    .replace('$1', mw.util.getUrl(currentPageTitle, { redirect: 'no' }))
                    .replace('$2', mw.html.escape(currentPageTitle)),
            );
            const [before, linkText, after] = extractContext(currentPageParameters.content, currentLink);
            ui.context
                .empty()
                .append($('<span></span>').text(before))
                .append($('<span></span>').text(linkText).addClass('disamassist-inclink'))
                .append($('<span></span>').text(after));
            const numLines = Math.ceil(ui.context.height() / parseFloat(ui.context.css('line-height')));
            if (numLines < cfg.numContextLines) {
                // Add cfg.numContextLines - numLines + 1 line breaks, so that the total number
                // of lines is cfg.numContextLines
                ui.context.append(new Array(cfg.numContextLines - numLines + 2).join('<br>'));
            }
            toggleFinishedMessage(false);
            ui.undoButton.prop('disabled', pageChanges.length === 0);
            ui.removeLinkButton.prop('disabled', currentPageParameters.redirect);
            choosing = true;
        }
    };

    /**
     * 更新待处理编辑数量的显示。
     */
    const updateEditCounter = () => {
        if (ui.pendingEditCounter) {
            ui.pendingEditCounter.text(
                txt.pendingEditCounter.replace('$1', editCount).replace('$2', countActuallyChangedFullyCheckedPages()),
            );
        }
        if (pendingEditBox) {
            if (editCount === 0 && !running) {
                togglePendingEditBox(false);
                notifyCompletion();
            }
            let textContent = editCount;
            if (editLimit) {
                textContent = txt.pendingEditBoxTimeEstimation
                    .replace('$1', editCount)
                    .replace('$2', secondsToHHMMSS(cfg.editCooldown * editCount));
            }
            pendingEditBoxText.text(txt.pendingEditBox.replace('$1', textContent));
        }
    };

    /**
     * 将指定来源页面的更改应用到待保存记录。
     * @param {Object} pageChange 待保存的页面更改。
     */
    const applyChange = pageChange => {
        if (pageChange.page.content !== pageChange.contentBefore[0]) {
            editCount++;
            const changeSummaries = pageChange.summary.join(txt.summarySeparator);
            const summary = txt.summary.replace('$1', getTargetPage()).replace('$2', changeSummaries);
            const save = editLimit ? saveWithCooldown : savePage;
            save(pageChange.title, pageChange.page, summary, true, true)
                .always(() => {
                    if (editCount > 0) {
                        editCount--;
                    }
                    updateEditCounter();
                })
                .fail(error);
            updateEditCounter();
        }
    };

    /**
     * 保存所有待处理的更改。
     */
    const applyAllChanges = () => {
        for (let ii = 0; ii < pageChanges.length; ii++) {
            applyChange(pageChanges[ii]);
        }
        pageChanges = [];
    };

    /**
     * 记录一次待处理的更改。
     * @param {string} pageTitle 页面标题。
     * @param {Object} page 页面数据。
     * @param {string} oldContent 更改前的页面内容。
     * @param {Object} link 被修改的链接。
     * @param {string} summary 编辑摘要。
     */
    const addChange = (pageTitle, page, oldContent, link, summary) => {
        if (pageChanges.length === 0 || pageChanges[pageChanges.length - 1].title !== pageTitle) {
            pageChanges.push({
                title: pageTitle,
                page: page,
                contentBefore: [],
                links: [],
                summary: [],
            });
        }
        const lastPageChange = pageChanges[pageChanges.length - 1];
        lastPageChange.contentBefore.push(oldContent);
        lastPageChange.links.push(link);
        lastPageChange.summary.push(summary);
    };

    /**
     * 检查历史记录中是否存在实际更改。
     * @returns {boolean} 是否存在实际更改。
     */
    const checkActualChanges = () => {
        return countActualChanges() !== 0;
    };

    /**
     * 返回历史记录中代表实际更改的条目数量。
     * @returns {number} 实际更改数量。
     */
    const countActualChanges = () => {
        let changeCount = 0;
        for (let ii = 0; ii < pageChanges.length; ii++) {
            if (pageChanges[ii].page.content !== pageChanges[ii].contentBefore[0]) {
                changeCount++;
            }
        }
        return changeCount;
    };

    /**
     * 返回已完成检查的页面数量；如果当前页面尚未处理完，则忽略最后一项。
     * @returns {number} 已完成检查且发生更改的页面数量。
     */
    const countActuallyChangedFullyCheckedPages = () => {
        let changeCount = countActualChanges();
        if (pageChanges.length !== 0) {
            const lastChange = pageChanges[pageChanges.length - 1];
            if (
                lastChange.title === currentPageTitle &&
                currentLink !== null &&
                lastChange.page.content !== lastChange.contentBefore[0]
            ) {
                changeCount--;
            }
        }
        return changeCount;
    };

    /**
     * 查找消歧义页面中的候选链接。
     * @returns {jQuery} 候选链接集合。
     */
    const getDisamOptions = () => {
        return $('#mw-content-text a').filter(function () {
            return !!extractPageName($(this));
        });
    };

    /**
     * 保存所有待处理的更改并关闭工具。
     */
    const saveAndEnd = () => {
        applyAllChanges();
        end();
    };

    /**
     * 结束工具并移除界面。
     */
    const end = () => {
        const currentToolUI = ui.display;
        choosing = false;
        running = false;
        startLink.removeClass('selected');
        $('.disamassist-optionmarker').remove();
        currentToolUI.fadeOut({
            complete: () => {
                currentToolUI.remove();
                if (editCount !== 0) {
                    togglePendingEditBox(true);
                }
            },
        });
    };

    /**
     * 显示错误信息。
     * @param {string} errorDescription 错误描述。
     */
    const error = errorDescription => {
        const errorBox = $('<div></div>').addClass('disamassist-box disamassist-errorbox');
        errorBox.text(txt.error.replace('$1', errorDescription));
        errorBox.append(
            createButton(txt.dismissError, () => {
                errorBox.fadeOut();
            }).addClass('disamassist-errorbutton'),
        );
        const uiIsInPlace = ui && $.contains(document.documentElement, ui.display[0]);
        const nextElement = uiIsInPlace ? ui.display : $('#mw-content-text');
        nextElement.before(errorBox);
        errorBox.hide().fadeIn();
    };

    /**
     * 修改链接，使其指向指定页面。
     * @param {string} text 页面完整维基文本。
     * @param {string} title 新的目标页面。
     * @param {Object} link 要修改的链接。
     * @param {string} [extra] 链接后追加的文本。
     * @param {boolean} [isRedirect] 当前页面是否为重定向页。
     * @returns {string} 修改后的页面文本。
     */
    const replaceLink = (text, title, link, extra, isRedirect) => {
        let newContent;
        let anchor = '';
        const hashPos = link.title.indexOf('#');
        if (hashPos !== -1) {
            anchor = link.title.substring(hashPos);
        }
        if (isSamePage(title, link.description)) {
            newContent = link.description;
        } else if (isRedirect) {
            newContent = title + anchor;
        } else {
            newContent = title + anchor + '|' + link.description;
        }
        const linkStart = text.substring(0, link.start);
        const linkEnd = text.substring(link.end);
        return linkStart + '[[' + newContent + ']]' + (extra || '') + linkEnd;
    };

    /**
     * 从页面文本中移除链接，但保留链接显示文本。
     * @param {string} text 页面维基文本。
     * @param {Object} link 要移除的链接。
     * @returns {string} 移除链接后的页面文本。
     */
    const removeLink = (text, link) => {
        const linkStart = text.substring(0, link.start);
        const linkEnd = text.substring(link.end);
        return linkStart + link.description + linkEnd;
    };

    /**
     * 从维基文本中提取链接。
     * @param {string} text 待读取的维基文本。
     * @param {number} lastIndex 搜索起始位置。
     * @param {number} [maxIndex] 搜索允许到达的最大位置。
     * @returns {?Object} 提取到的链接对象；找不到时返回 `null`。
     */
    const extractLink = (text, lastIndex, maxIndex) => {
        // 用平衡括号方法正确处理嵌套 [[...]] 结构，
        // 避免 [[File:...|说明[[目标]]]] 中内层链接被外层吞掉
        const startRe = /\[\[/g;
        startRe.lastIndex = lastIndex;
        const startMatch = startRe.exec(text);
        if (startMatch === null) {
            return null;
        }
        if (maxIndex !== undefined && startMatch.index >= maxIndex) {
            return null;
        }

        const start = startMatch.index;
        let i = start + 2;
        let depth = 1;
        let firstPipe = -1;

        // 扫描到匹配的 ]]，跟踪嵌套深度
        while (i < text.length && depth > 0) {
            if (text[i] === '[' && text[i + 1] === '[') {
                depth++;
                i += 2;
            } else if (text[i] === ']' && text[i + 1] === ']') {
                depth--;
                i += 2;
            } else if (text[i] === '|' && depth === 1 && firstPipe === -1) {
                firstPipe = i;
                i++;
            } else {
                i++;
            }
        }

        if (depth > 0) {
            // 没有匹配的 ]]
            return null;
        }

        const bracketEnd = i; // 闭合括号之后的位置
        let title, description;
        if (firstPipe >= 0) {
            title = text.substring(start + 2, firstPipe);
            description = text.substring(firstPipe + 1, bracketEnd - 2);
        } else {
            title = text.substring(start + 2, bracketEnd - 2);
            description = title;
        }

        return {
            start: start,
            end: bracketEnd,
            bracketEnd: bracketEnd,
            title: title,
            description: description,
        };
    };

    /**
     * 从文本中查找指向候选目标页面的链接。
     * @param {string} text 页面维基文本。
     * @param {string[]} destinations 可能的目标页面列表。
     * @param {number} lastIndex 搜索起始位置。
     * @param {number} [maxIndex] 搜索允许到达的最大位置。
     * @returns {?Object} 找到的链接对象；找不到时返回 `null`。
     */
    const extractLinkToPage = (text, destinations, lastIndex, maxIndex) => {
        let link, title;
        do {
            link = extractLink(text, lastIndex, maxIndex);
            if (link !== null) {
                title = getCanonicalTitle(link.title);

                // 外层链接是消歧义目标，直接返回
                if (isLinkToDisamTarget(title)) {
                    return link;
                }

                // 外层非目标，但 description 含嵌套链接，递归查找内层
                if (link.description && link.description.indexOf('[[') !== -1) {
                    const innerLink = extractLinkToPage(text, destinations, link.start + 2, link.bracketEnd - 2);
                    if (innerLink !== null) {
                        return innerLink;
                    }
                }

                lastIndex = link.end;
            }
        } while (link !== null);
        return null;
    };

    let variantLookupTable = {};

    const isLinkToDisamTarget = title => {
        return Object.hasOwn(variantLookupTable, title);
    };

    /**
     * 建立语言变体查找表：把目标页面在各语言变体下的显示形式都登记为消歧义目标。
     * @param {string[]} destinations 目标页面列表。
     * @param {Function} callback 所有变体请求完成后的回调。
     */
    const buildVariantLookupTable = (destinations, callback) => {
        variantLookupTable = {};
        for (const dest of destinations) {
            variantLookupTable[dest] = true;
        }

        const variants = ['zh-hans', 'zh-hant', 'zh-cn', 'zh-tw', 'zh-hk'];
        const totalRequests = destinations.length * variants.length;
        let completedRequests = 0;

        if (totalRequests === 0) {
            callback();
            return;
        }

        for (const dest of destinations) {
            for (const variant of variants) {
                api.post({
                    action: 'parse',
                    text: dest,
                    prop: 'text',
                    variant: variant,
                    formatversion: 2,
                })
                    .done(({ parse }) => {
                        const convertedText = $(parse?.text ?? '')
                            .text()
                            .trim();
                        if (convertedText && !Object.hasOwn(variantLookupTable, convertedText)) {
                            variantLookupTable[convertedText] = true;
                        }
                    })
                    .always(() => {
                        completedRequests++;
                        if (completedRequests === totalRequests) {
                            callback();
                        }
                    });
            }
        }
    };

    /**
     * 查找目标页面：强制同一页面时返回当前页面，否则返回从消歧义标题中提取的主题页面。
     * @returns {string} 目标页面标题。
     */
    const getTargetPage = () => {
        const title = wgPageName.replace(/_/g, ' ');
        return forceSamePage ? title : removeDisam(title);
    };

    /**
     * 去掉页面标题末尾的“(消歧义页)”后缀，得到对应的主题条目标题。
     * @param {string} title 页面标题。
     * @returns {string} 去掉后缀后的标题；不含该后缀时原样返回。
     */
    const removeDisam = title => title.replace(/\(消歧义页\)$/, '');

    /**
     * 判断两个页面标题是否相同。
     * @param {string} title1 第一个页面标题。
     * @param {string} title2 第二个页面标题。
     * @returns {boolean} 两个标题是否相同。
     */
    const isSamePage = (title1, title2) => getCanonicalTitle(title1) === getCanonicalTitle(title2);

    /**
     * 返回页面标题的规范形式。
     * @param {string} title 页面标题。
     * @returns {string} 规范化后的页面标题。
     */
    const getCanonicalTitle = title => {
        try {
            title = new mw.Title(title).getPrefixedText();
        } catch {
            // mw.Title seems to be buggy, and some valid titles are rejected
            // FIXME: This may cause false negatives
        }
        return title;
    };

    /**
     * 提取链接周围的上下文文本。
     * @param {string} text 页面文本。
     * @param {Object} link 链接对象。
     * @returns {string[]} 链接前、链接本身和链接后的上下文。
     */
    const extractContext = (text, link) => {
        const contextStart = link.start - cfg.radius;
        const contextEnd = link.end + cfg.radius;
        let contextPrev = text.substring(contextStart, link.start);
        if (contextStart > 0) {
            contextPrev = txt.ellipsis + contextPrev;
        }
        let contextNext = text.substring(link.end, contextEnd);
        if (contextEnd < text.length) {
            contextNext = contextNext + txt.ellipsis;
        }
        return [contextPrev, text.substring(link.start, link.end), contextNext];
    };

    /**
     * 从链接中提取带命名空间的页面名称。
     * @param {jQuery} link 页面链接。
     * @returns {?string} 页面名称；无法提取时返回 `null`。
     */
    const extractPageName = link => {
        let pageName = extractPageNameRaw(link);
        if (pageName) {
            const sectionPos = pageName.indexOf('#');
            let section = '';
            if (sectionPos !== -1) {
                section = pageName.substring(sectionPos);
                pageName = pageName.substring(0, sectionPos);
            }
            return getCanonicalTitle(pageName) + section;
        } else {
            return null;
        }
    };

    /**
     * 按链接原始形式提取页面名称。
     * @param {jQuery} link 页面链接。
     * @returns {?string} 原始页面名称；无法提取时返回 `null`。
     */
    const extractPageNameRaw = link => {
        if (!link.hasClass('image')) {
            const href = link.attr('href');
            if (link.hasClass('new')) {
                // "Red" link
                if (href.indexOf(wgScript) === 0) {
                    return mw.util.getParamValue('title', href);
                }
            } else {
                const regex = wgArticlePath.replace('$1', '(.*)');
                const regexResult = RegExp('^' + regex + '$').exec(href);
                if ($.isArray(regexResult) && regexResult.length > 1) {
                    return decodeURIComponent(regexResult[1]);
                }
            }
        }
        return null;
    };

    /**
     * 将秒数格式化为 `HH:MM:SS` 或 `MM:SS`。
     * @param {number} totalSeconds 总秒数。
     * @returns {string} 格式化后的时间。
     */
    const secondsToHHMMSS = totalSeconds => {
        let hhmmss = '';
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = Math.floor((totalSeconds % 3600) % 60);
        if (hours >= 1) {
            hhmmss = pad(hours, '0', 2) + ':';
        }
        hhmmss += pad(minutes, '0', 2) + ':' + pad(seconds, '0', 2);
        return hhmmss;
    };

    /**
     * 将值转换为字符串并填充到指定宽度。
     * @param {*} str 待处理的值。
     * @param {string} z 填充字符。
     * @param {number} width 目标宽度。
     * @returns {string} 填充后的字符串。
     */
    const pad = (str, z, width) => {
        str = str.toString();
        if (str.length >= width) {
            return str;
        } else {
            return new Array(width - str.length + 1).join(z) + str;
        }
    };

    /**
     * 创建一个按钮。
     * @param {string} text 按钮显示文本。
     * @param {Function} onClick 点击处理函数。
     * @returns {jQuery} 创建的按钮元素。
     */
    const createButton = (text, onClick) => {
        const button = $('<input></input>', { type: 'button', value: text });
        button.addClass('disamassist-button').click(onClick);
        return button;
    };

    /**
     * 沿重定向链解析最终页面。
     * @param {string} pageTitle 起始页面标题。
     * @param {Object[]} possibleRedirects 可能的重定向规则。
     * @returns {string} 重定向链末端的页面标题。
     */
    const resolveRedirect = (pageTitle, possibleRedirects) => {
        let appliedRedirect = true;
        const visitedPages = {};
        let currentPage = getCanonicalTitle(pageTitle);
        while (appliedRedirect) {
            appliedRedirect = false;
            for (let ii = 0; ii < possibleRedirects.length; ii++) {
                if (possibleRedirects[ii].from === currentPage) {
                    if (visitedPages[possibleRedirects[ii].to]) {
                        // Redirect chain detected
                        return pageTitle;
                    }
                    visitedPages[currentPage] = true;
                    appliedRedirect = true;
                    currentPage = possibleRedirects[ii].to;
                }
            }
        }
        // No redirect rules applied for an iteration of the outer loop:
        // no more redirects. We are done
        return currentPage;
    };

    /**
     * 获取目标页面的入链。
     * @param {string} page 目标页面标题。
     * @returns {jQuery.Promise} 成功时返回入链标题和可能的目标标题列表。
     */
    const getBacklinks = page => {
        const dfd = new $.Deferred();

        // 递归函数处理分页
        const fetchBacklinks = (page, continueParam) => {
            const params = {
                action: 'query',
                list: 'backlinks',
                bltitle: page,
                blredirect: true,
                bllimit: cfg.backlinkLimit,
                blnamespace: cfg.targetNamespaces.join('|'),
                formatversion: 2,
            };

            // 如果有continue参数，则添加到请求中
            if (continueParam) {
                params.blcontinue = continueParam.blcontinue;
                params.continue = continueParam.continue;
            }

            return api.post(params).then(({ query, continue: continuation }) => {
                // 收集当前页的反向链接
                const backlinks = [];
                const linkTitles = [];

                for (const { title, redirlinks } of query.backlinks) {
                    backlinks.push(title);
                    if (redirlinks) {
                        linkTitles.push(title);
                        for (const { title: redirectTitle } of redirlinks) {
                            backlinks.push(redirectTitle);
                        }
                    }
                }

                // 检查是否有更多结果
                if (continuation?.blcontinue) {
                    // 递归获取下一页结果
                    return fetchBacklinks(page, continuation).then(nextResult => {
                        // 合并结果
                        return {
                            backlinks: backlinks.concat(nextResult.backlinks),
                            linkTitles: linkTitles.concat(nextResult.linkTitles),
                        };
                    });
                }
                // 没有更多结果，返回当前结果
                return {
                    backlinks: backlinks,
                    linkTitles: linkTitles,
                };
            });
        };

        // 开始获取反向链接
        fetchBacklinks(page)
            .then(({ backlinks, linkTitles }) => {
                dfd.resolve(backlinks, linkTitles);
            })
            .fail(code => {
                dfd.reject(txt.getBacklinksError.replace('$1', code));
            });

        return dfd.promise();
    };

    /**
     * 下载指定页面的重定向列表。
     * @param {string[]} pageTitles 页面标题列表。
     * @returns {jQuery.Promise} 成功时返回重定向规则列表。
     */
    const fetchRedirects = pageTitles => {
        const dfd = new $.Deferred();
        let allRedirects = [];
        const fetchNext = index => {
            if (index >= pageTitles.length) {
                dfd.resolve(allRedirects);
                return;
            }
            api.post({
                action: 'query',
                titles: pageTitles[index],
                redirects: true,
                formatversion: 2,
            })
                .done(({ query }) => {
                    allRedirects = allRedirects.concat(query.redirects ?? []);
                    fetchNext(index + 1);
                })
                .fail(code => {
                    dfd.reject(txt.fetchRedirectsError.replace('$1', code));
                });
        };
        fetchNext(0);
        return dfd.promise();
    };

    /**
     * 获取当前用户的权限列表。
     * @returns {jQuery.Promise} 成功时返回权限名称数组。
     */
    const fetchRights = () => {
        const dfd = $.Deferred();
        api.post({
            action: 'query',
            meta: 'userinfo',
            uiprop: 'rights',
            formatversion: 2,
        })
            .done(({ query }) => {
                dfd.resolve(query.userinfo.rights);
            })
            .fail(code => {
                dfd.reject(txt.fetchRightsError.replace('$1', code));
            });
        return dfd.promise();
    };

    /**
     * 获取指定页面的原始文本。
     * @param {string} pageTitle 页面标题。
     * @returns {jQuery.Promise} 成功时返回页面数据。
     */
    const loadPage = pageTitle => {
        return loadPagesBatch([pageTitle]).then(results => {
            return results[pageTitle];
        });
    };

    /**
     * 批量加载多个页面。
     * @param {string[]} pageTitles 页面标题列表。
     * @returns {jQuery.Promise} 成功时返回按标题索引的页面数据。
     */
    const loadPagesBatch = pageTitles => {
        const dfd = new $.Deferred();
        if (pageTitles.length === 0) {
            dfd.resolve({});
            return dfd.promise();
        }
        api.post({
            action: 'query',
            titles: pageTitles.join('|'),
            prop: 'revisions',
            rvprop: 'timestamp|content',
            meta: 'tokens',
            type: 'csrf',
            formatversion: 2,
        })
            .done(({ query }) => {
                const { pages, tokens } = query;
                const results = {};
                for (const { title, revisions, redirect, missing, starttimestamp } of pages) {
                    const content = revisions ? revisions[0].content : '';
                    results[title] = {
                        redirect: !!redirect || /^\s*#(REDIRECT|重定向)\s*\[\[/i.test(content),
                        missing: !!missing,
                        content: content,
                        baseTimeStamp: revisions ? revisions[0].timestamp : null,
                        startTimeStamp: starttimestamp,
                        editToken: tokens.csrftoken,
                    };
                }
                dfd.resolve(results);
            })
            .fail(code => {
                dfd.reject(txt.loadPageError.replace('$1', pageTitles.join(', ')).replace('$2', code));
            });
        return dfd.promise();
    };

    /**
     * 预取链接队列中的下一批页面，并写入页面缓存。
     * @param {Function} [callback] 预取成功或失败后的可选回调。
     */
    const prefetchNextBatch = callback => {
        if (prefetchInProgress) {
            if (callback) {
                callback();
            }
            return;
        }
        const batch = [];
        for (let i = 0; i < links.length && batch.length < cfg.queryTitleLimit; i++) {
            if (!Object.hasOwn(pageCache, links[i])) {
                batch.push(links[i]);
            }
        }
        if (batch.length === 0) {
            if (callback) {
                callback();
            }
            return;
        }
        prefetchInProgress = true;
        loadPagesBatch(batch)
            .done(results => {
                $.extend(pageCache, results);
                prefetchInProgress = false;
                if (callback) {
                    callback();
                }
            })
            .fail(description => {
                prefetchInProgress = false;
                if (callback) {
                    error(description);
                    callback();
                } else {
                    console.warn('[DisamAssist] prefetch failed:', description);
                }
            });
    };

    /**
     * 注册页面更改，并按照编辑冷却时间延迟保存。
     * @returns {jQuery.Promise} 表示保存结果的 jQuery Promise。
     */
    const saveWithCooldown = function () {
        const deferred = new $.Deferred();
        pendingSaves.push({ args: arguments, dfd: deferred });
        if (!runningSaves) {
            checkAndSave();
        }
        return deferred.promise();
    };

    /**
     * 在满足编辑冷却时间后保存队列中的下一项更改。
     */
    const checkAndSave = function () {
        if (pendingSaves.length === 0) {
            runningSaves = false;
            return;
        }
        runningSaves = true;
        const millisSinceLast = new Date().getTime() - lastEditMillis;
        if (millisSinceLast < cfg.editCooldown * 1000) {
            setTimeout(checkAndSave, cfg.editCooldown * 1000 - millisSinceLast);
        } else {
            // The last edit started at least cfg.editCooldown seconds ago
            const save = pendingSaves.shift();
            savePage
                .apply(this, save.args)
                .done(() => {
                    checkAndSave();
                    save.dfd.resolve();
                })
                .fail(description => {
                    checkAndSave();
                    save.dfd.reject(description);
                });
            // We'll use the time since the last edit started
            lastEditMillis = new Date().getTime();
        }
    };

    /**
     * 保存指定页面的更改。
     * @param {string} pageTitle 页面标题。
     * @param {Object} page 页面数据。
     * @param {string} summary 编辑摘要。
     * @param {boolean} minorEdit 是否标记为小编辑。
     * @param {boolean} botEdit 是否标记为机器人编辑。
     * @returns {jQuery.Promise} 表示保存结果的 jQuery Promise。
     */
    const savePage = (pageTitle, page, summary, minorEdit, botEdit) => {
        const dfd = new $.Deferred();
        api.post({
            action: 'edit',
            title: pageTitle,
            token: page.editToken,
            text: page.content,
            basetimestamp: page.baseTimeStamp,
            starttimestamp: page.startTimeStamp,
            summary: summary,
            watchlist: cfg.watch,
            minor: minorEdit,
            bot: botEdit,
            tags: 'Automation tool',
            formatversion: 2,
        })
            .done(() => {
                dfd.resolve();
            })
            .fail(code => {
                dfd.reject(txt.savePageError.replace('$1', pageTitle).replace('$2', code));
            });
        return dfd.promise();
    };

    install();
});
