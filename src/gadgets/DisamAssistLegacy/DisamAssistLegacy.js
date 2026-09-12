'use strict';
(function (mw, $, undefined) {
    var cfg = {};
    var txt = {};
    var startLink, ui;
    var links, pageChanges;
    var currentPageTitle, currentPageParameters, currentLink;
    var possibleBacklinkDestinations;
    var forceSamePage = false;
    var running = false;
    var choosing = false;
    var displayedPages = {};
    var pageCache = {};
    var prefetchInProgress = false;
    var editCount = 0;
    var editLimit;
    var pendingSaves = [];
    var pendingEditBox = null;
    var pendingEditBoxText;
    var lastEditMillis = 0;
    var runningSaves = false;

    /*
     * Entry point. Check whether we are in a disambiguation page. If so, add a link to start the tool
     */
    var install = function () {
        cfg = window.DisamAssist.cfg;
        txt = window.DisamAssist.txt;
        if (mw.config.get('wgAction') === 'view' && isDisam()) {
            mw.loader.using(['mediawiki.Title', 'mediawiki.api'], function () {
                $(document).ready(function () {
                    // This is a " (disambiguation)" page
                    if (new RegExp(cfg.disamRegExp).exec(getTitle())) {
                        var startMainLink = $(
                            mw.util.addPortletLink('p-cactions', '#', txt.startMain, 'ca-disamassist-main'),
                        ).click(startMain);
                        var startSameLink = $(
                            mw.util.addPortletLink('p-cactions', '#', txt.startSame, 'ca-disamassist-same'),
                        ).click(startSame);
                        startLink = startMainLink.add(startSameLink);
                    } else {
                        startLink = $(
                            mw.util.addPortletLink('p-cactions', '#', txt.start, 'ca-disamassist-page'),
                        ).click(start);
                    }
                });
            });
        }
    };

    /*
     * Start the tool. Display the UI and begin looking for links to fix
     */
    var start = function () {
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
            checkEditLimit().then(function () {
                togglePendingEditBox(false);
                doPage();
            });
        }
    };

    /*
     * Start DisamAssist. Disambiguate incoming links to the current page, regardless
     * of the title.
     */
    var startSame = function () {
        forceSamePage = true;
        start();
    };

    /*
     * Start DisamAssist. If the page title ends with " (disambiguation)", disambiguate
     * links to the primary topic article. Otherwise, disambiguate links to the current
     * page.
     */
    var startMain = function () {
        forceSamePage = false;
        start();
    };

    /*
     * Create and show the user interface.
     */
    var createUI = function () {
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
            disamNeededButton: cfg.disamNeededText
                ? createButton(txt.disamNeeded, chooseDisamNeeded)
                : $('<span></span>'),
            removeLinkButton: createButton(txt.removeLink, chooseLinkRemoval),
        };
        var top = $('<div></div>')
            .addClass('disamassist-top')
            .append([ui.pendingEditCounter, ui.finishedMessage, ui.pageTitleLine]);
        var leftButtons = $('<div></div>')
            .addClass('disamassist-leftbuttons')
            .append([ui.titleAsTextButton, ui.removeLinkButton, ui.disamNeededButton, ui.omitButton]);
        var rightButtons = $('<div></div>')
            .addClass('disamassist-rightbuttons')
            .append([ui.undoButton, ui.refreshButton, ui.endButton]);
        var allButtons = $('<div></div>').addClass('disamassist-allbuttons').append([leftButtons, rightButtons]);
        ui.display.append([top, ui.context, allButtons]);
        updateEditCounter();
        toggleActionButtons(false);
        // Insert the UI in the page
        $('#mw-content-text').before(ui.display);
        ui.display.hide().fadeIn();
    };

    /*
     * If there are pending changes, show a confirm dialog before closing
     */
    var addUnloadConfirm = function () {
        $(window).on('beforeunload', function (ev) {
            if (running && checkActualChanges()) {
                return txt.pending;
            } else if (editCount !== 0) {
                return txt.editInProgress;
            }
        });
    };

    /*
     * Mark the disambiguation options as such
     */
    var markDisamOptions = function () {
        var optionPageTitles = [];
        var optionMarkers = [];
        getDisamOptions().each(function () {
            var link = $(this);
            var title = extractPageName(link);
            var optionMarker = $('<a></a>')
                .attr('href', '#')
                .addClass('disamassist-optionmarker')
                .text(txt.optionMarker)
                .click(function (ev) {
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
        var targetPage = getTargetPage();
        fetchRedirects(optionPageTitles.concat(targetPage))
            .done(function (redirects) {
                var endTargetPage = resolveRedirect(targetPage, redirects);
                for (var ii = 0; ii < optionPageTitles.length; ii++) {
                    var endOptionTitle = resolveRedirect(optionPageTitles[ii], redirects);
                    if (isSamePage(optionPageTitles[ii], targetPage)) {
                        optionMarkers[ii].text(txt.targetOptionMarker).addClass('disamassist-curroptionmarker');
                    } else if (isSamePage(endOptionTitle, endTargetPage)) {
                        optionMarkers[ii].text(txt.redirectOptionMarker).addClass('disamassist-curroptionmarker');
                    }
                }
            })
            .fail(error);
    };

    /*
     * Check whether the edit cooldown applies and sets editLimit accordingly.
     * Returns a jQuery promise
     */
    var checkEditLimit = function () {
        var dfd = new $.Deferred();
        if (cfg.editCooldown <= 0) {
            editLimit = false;
            dfd.resolve();
        } else {
            fetchRights()
                .done(function (rights) {
                    editLimit = $.inArray('bot', rights) === -1;
                })
                .fail(function (description) {
                    error(description);
                    editLimit = true;
                })
                .always(function () {
                    dfd.resolve();
                });
        }
        return dfd.promise();
    };

    /*
     * Find and ask the user to fix all the incoming links to the disambiguation ("target")
     * page from a single "origin" page
     */
    var doPage = function () {
        if (pageChanges.length > cfg.historySize) {
            applyChange(pageChanges.shift());
        }
        if (links.length === 0) {
            var targetPage = getTargetPage();
            getBacklinks(targetPage)
                .done(function (backlinks, pageTitles) {
                    var pending = {};
                    $.each(pendingSaves, function () {
                        pending[this[0]] = true;
                    });
                    var baseDestinations = [targetPage];
                    $.each(pageTitles, function (_, t) {
                        if (t != targetPage && removeDisam(t) != targetPage) {
                            baseDestinations.push(t);
                        }
                    });
                    possibleBacklinkDestinations = baseDestinations;
                    buildVariantLookupTable(baseDestinations, function () {
                        links = $.grep(backlinks, function (el, ii) {
                            return !displayedPages[el] && !pending[el];
                        });
                        if (links.length === 0) {
                            updateContext();
                        } else {
                            prefetchNextBatch(function () {
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

            var cachedPage = pageCache[currentPageTitle];
            if (cachedPage) {
                delete pageCache[currentPageTitle];
                currentPageParameters = cachedPage;
                currentLink = null;

                var cacheSize = Object.keys(pageCache).length;
                if (cacheSize <= 1 && links.length > 0) {
                    prefetchNextBatch();
                }

                doLink();
            } else {
                // Cache miss: 如果预取正在进行中，只加载当前页面，避免重复请求
                if (prefetchInProgress) {
                    loadPage(currentPageTitle)
                        .done(function (result) {
                            currentPageParameters = result;
                            currentLink = null;
                            doLink();
                        })
                        .fail(error);
                } else {
                    // 预取未在运行，批量加载当前页面 + 剩余未缓存的页面
                    var batchTitles = [currentPageTitle];
                    for (var i = 0; i < links.length && batchTitles.length < cfg.queryTitleLimit; i++) {
                        if (!pageCache.hasOwnProperty(links[i])) {
                            batchTitles.push(links[i]);
                        }
                    }
                    loadPagesBatch(batchTitles)
                        .done(function (results) {
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

    /*
     * Find and ask the user to fix a single incoming link to the disambiguation ("target")
     * page
     */
    var doLink = function () {
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

    /*
     * Replace the target of a link with a different one
     * pageTitle: New link target
     * extra: Additional text after the link (optional)
     * summary: Change summary (optional)
     */
    var chooseReplacement = function (pageTitle, extra, summary) {
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

    /*
     * Prompt for an alternative link target and use it as a replacement
     */
    var chooseTitleFromPrompt = function () {
        var title = prompt(txt.titleAsTextPrompt);
        if (title !== null) {
            chooseReplacement(title);
        }
    };

    /*
     * Remove the current link, leaving the text unchanged
     */
    var chooseLinkRemoval = function () {
        if (choosing) {
            var summary = txt.summaryRemoved;
            addChange(currentPageTitle, currentPageParameters, currentPageParameters.content, currentLink, summary);
            currentPageParameters.content = removeLink(currentPageParameters.content, currentLink);
            doLink();
        }
    };

    /*
     * Add a "disambiguation needed" template after the link
     */
    var chooseDisamNeeded = function () {
        chooseReplacement(currentLink.title, cfg.disamNeededText, txt.summaryHelpNeeded);
    };

    /*
     * Undo the last change
     */
    var undo = function () {
        if (pageChanges.length !== 0) {
            var lastPage = pageChanges[pageChanges.length - 1];
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

    /*
     * Omit the current link without making a change
     */
    var omit = function () {
        chooseReplacement(null);
    };

    /*
     * Save all the pending changes and restart the tool.
     */
    var refresh = function () {
        saveAndEnd();
        start();
    };

    /*
     * Enable or disable the buttons that can perform actions on a page or change the current link.
     * enabled: Whether to enable or disable the buttons
     */
    var toggleActionButtons = function (enabled) {
        var affectedButtons = [
            ui.omitButton,
            ui.titleAsTextButton,
            ui.removeLinkButton,
            ui.disamNeededButton,
            ui.undoButton,
        ];
        $.each(affectedButtons, function (ii, button) {
            button.prop('disabled', !enabled);
        });
    };

    /*
     * Show or hide the 'no more links' message
     * show: Whether to show or hide the message
     */
    var toggleFinishedMessage = function (show) {
        toggleActionButtons(!show);
        ui.undoButton.prop('disabled', pageChanges.length === 0);
        ui.finishedMessage.toggle(show);
        ui.pageTitleLine.toggle(!show);
        ui.context.toggle(!show);
    };

    var togglePendingEditBox = function (show) {
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

    var notifyCompletion = function () {
        var oldTitle = document.title;
        document.title = txt.notifyCharacter + document.title;
        $(document.body).one('mousemove', function () {
            document.title = oldTitle;
        });
    };

    /*
     * Update the displayed information to match the current link
     * or lack thereof
     */
    var updateContext = function () {
        updateEditCounter();
        if (!currentLink) {
            toggleFinishedMessage(true);
        } else {
            ui.pageTitleLine.html(
                txt.pageTitleLine
                    .replace('$1', mw.util.getUrl(currentPageTitle, { redirect: 'no' }))
                    .replace('$2', mw.html.escape(currentPageTitle)),
            );
            var context = extractContext(currentPageParameters.content, currentLink);
            ui.context
                .empty()
                .append($('<span></span>').text(context[0]))
                .append($('<span></span>').text(context[1]).addClass('disamassist-inclink'))
                .append($('<span></span>').text(context[2]));
            var numLines = Math.ceil(ui.context.height() / parseFloat(ui.context.css('line-height')));
            if (numLines < cfg.numContextLines) {
                // Add cfg.numContextLines - numLines + 1 line breaks, so that the total number
                // of lines is cfg.numContextLines
                ui.context.append(new Array(cfg.numContextLines - numLines + 2).join('<br>'));
            }
            toggleFinishedMessage(false);
            ui.undoButton.prop('disabled', pageChanges.length === 0);
            ui.removeLinkButton.prop('disabled', currentPageParameters.redirect);
            ui.disamNeededButton.prop('disabled', currentPageParameters.redirect || currentLink.hasDisamTemplate);
            choosing = true;
        }
    };

    /*
     * Update the count of pending changes
     */
    var updateEditCounter = function () {
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
            var textContent = editCount;
            if (editLimit) {
                textContent = txt.pendingEditBoxTimeEstimation
                    .replace('$1', editCount)
                    .replace('$2', secondsToHHMMSS(cfg.editCooldown * editCount));
            }
            pendingEditBoxText.text(txt.pendingEditBox.replace('$1', textContent));
        }
    };

    /*
     * Apply the changes made to an "origin" page
     * pageChange: Change that will be saved
     */
    var applyChange = function (pageChange) {
        if (pageChange.page.content !== pageChange.contentBefore[0]) {
            editCount++;
            var changeSummaries = pageChange.summary.join(txt.summarySeparator);
            var summary = txt.summary.replace('$1', getTargetPage()).replace('$2', changeSummaries);
            var save = editLimit ? saveWithCooldown : savePage;
            save(pageChange.title, pageChange.page, summary, true, true)
                .always(function () {
                    if (editCount > 0) {
                        editCount--;
                    }
                    updateEditCounter();
                })
                .fail(error);
            updateEditCounter();
        }
    };

    /*
     * Save all the pending changes
     */
    var applyAllChanges = function () {
        for (var ii = 0; ii < pageChanges.length; ii++) {
            applyChange(pageChanges[ii]);
        }
        pageChanges = [];
    };

    /*
     * Record a new pending change
     * pageTitle: Title of the page
     * page: Content of the page
     * oldContent: Content of the page before the change
     * link: Link that has been changed
     * summary: Change summary
     */
    var addChange = function (pageTitle, page, oldContent, link, summary) {
        if (pageChanges.length === 0 || pageChanges[pageChanges.length - 1].title !== pageTitle) {
            pageChanges.push({
                title: pageTitle,
                page: page,
                contentBefore: [],
                links: [],
                summary: [],
            });
        }
        var lastPageChange = pageChanges[pageChanges.length - 1];
        lastPageChange.contentBefore.push(oldContent);
        lastPageChange.links.push(link);
        lastPageChange.summary.push(summary);
    };

    /*
     * Check whether actual changes are stored in the history array
     */
    var checkActualChanges = function () {
        return countActualChanges() !== 0;
    };

    /*
     * Return the number of entries in the history array that represent actual changes
     */
    var countActualChanges = function () {
        var changeCount = 0;
        for (var ii = 0; ii < pageChanges.length; ii++) {
            if (pageChanges[ii].page.content !== pageChanges[ii].contentBefore[0]) {
                changeCount++;
            }
        }
        return changeCount;
    };

    /*
     * Return the number of changed pages in the history array, ignoring the last entry
     * if we aren't done with that page yet
     */
    var countActuallyChangedFullyCheckedPages = function () {
        var changeCount = countActualChanges();
        if (pageChanges.length !== 0) {
            var lastChange = pageChanges[pageChanges.length - 1];
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

    /*
     * Find the links to disambiguation options in a disambiguation page
     */
    var getDisamOptions = function () {
        return $('#mw-content-text a').filter(function () {
            return !!extractPageName($(this));
        });
    };

    /*
     * Save all the pending changes and close the tool
     */
    var saveAndEnd = function () {
        applyAllChanges();
        end();
    };

    /*
     * Close the tool
     */
    var end = function () {
        var currentToolUI = ui.display;
        choosing = false;
        running = false;
        startLink.removeClass('selected');
        $('.disamassist-optionmarker').remove();
        currentToolUI.fadeOut({
            complete: function () {
                currentToolUI.remove();
                if (editCount !== 0) {
                    togglePendingEditBox(true);
                }
            },
        });
    };

    /*
     * Display an error message
     */
    var error = function (errorDescription) {
        var errorBox = $('<div></div>').addClass('disamassist-box disamassist-errorbox');
        errorBox.text(txt.error.replace('$1', errorDescription));
        errorBox.append(
            createButton(txt.dismissError, function () {
                errorBox.fadeOut();
            }).addClass('disamassist-errorbutton'),
        );
        var uiIsInPlace = ui && $.contains(document.documentElement, ui.display[0]);
        var nextElement = uiIsInPlace ? ui.display : $('#mw-content-text');
        nextElement.before(errorBox);
        errorBox.hide().fadeIn();
    };

    /*
     * Change a link so that it points to the title
     * text: The wikitext of the whole page
     * title: The new destination of the link
     * link: The link that will be modified
     * extra: Text that will be added after the link (optional)
     * isRedirect: Whether the current page is a redirect page (optional)
     */
    var replaceLink = function (text, title, link, extra, isRedirect) {
        var newContent;
        var anchor = '';
        var hashPos = link.title.indexOf('#');
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
        var linkStart = text.substring(0, link.start);
        var linkEnd = text.substring(link.end);
        return linkStart + '[[' + newContent + ']]' + link.afterDescription + (extra || '') + linkEnd;
    };

    /*
     * Remove a link from the text
     * text: The wikitext of the whole page
     * link: The link that will be removed
     */
    var removeLink = function (text, link) {
        var linkStart = text.substring(0, link.start);
        var linkEnd = text.substring(link.end);
        return linkStart + link.description + link.afterDescription + linkEnd;
    };

    /*
     * Extract a link from a string in wiki format,
     * starting from a given index. Return a link if one can be found,
     * otherwise return null. The "link" includes "disambiguation needed"
     * templates inmediately following the link proper
     * text: Text from which the link will be extracted
     * lastIndex: Index from which the search will start
     */
    var extractLink = function (text, lastIndex, maxIndex) {
        // 用平衡括号方法正确处理嵌套 [[...]] 结构，
        // 避免 [[File:...|说明[[目标]]]] 中内层链接被外层吞掉
        var startRe = /\[\[/g;
        startRe.lastIndex = lastIndex;
        var startMatch = startRe.exec(text);
        if (startMatch === null) {
            return null;
        }
        if (maxIndex !== undefined && startMatch.index >= maxIndex) {
            return null;
        }

        var start = startMatch.index;
        var i = start + 2;
        var depth = 1;
        var firstPipe = -1;

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

        var bracketEnd = i; // ]] 之后的位置
        var title, description;
        if (firstPipe >= 0) {
            title = text.substring(start + 2, firstPipe);
            description = text.substring(firstPipe + 1, bracketEnd - 2);
        } else {
            title = text.substring(start + 2, bracketEnd - 2);
            description = title;
        }

        // 消歧义needed模板处理
        var templateRegex = /^(\w*[.,:;?!)}\s]*){{\s*([^|{}]+?)\s*(?:\|[^{]*?)?}}/;
        var possiblyAmbiguous = true;
        var hasDisamTemplate = false;
        var afterDescription = '';
        var end = bracketEnd;
        var rest = text.substring(end);
        var templateMatch = templateRegex.exec(rest);
        if (templateMatch !== null) {
            var templateTitle = getCanonicalTitle(templateMatch[2]);
            if ($.inArray(templateTitle, cfg.disamLinkTemplates) !== -1) {
                end += templateMatch[0].length;
                afterDescription = templateMatch[1].replace(/\s$/, '');
                hasDisamTemplate = true;
            } else if ($.inArray(templateTitle, cfg.disamLinkIgnoreTemplates) !== -1) {
                possiblyAmbiguous = false;
            }
        }

        return {
            start: start,
            end: end,
            bracketEnd: bracketEnd,
            possiblyAmbiguous: possiblyAmbiguous,
            hasDisamTemplate: hasDisamTemplate,
            title: title,
            description: description,
            afterDescription: afterDescription,
        };
    };

    /*
     * Extract a link to one of a number of destination pages from a string
     * ("text") in wiki format, starting from a given index ("lastIndex").
     * "Disambiguation needed" templates are included as part of the links.
     * text: Page in wiki format
     * destinations: Array of page titles to look for
     * lastIndex: Index from which the search will start
     */
    var extractLinkToPage = function (text, destinations, lastIndex, maxIndex) {
        var link, title;
        do {
            link = extractLink(text, lastIndex, maxIndex);
            if (link !== null) {
                title = getCanonicalTitle(link.title);

                // 外层链接是消歧义目标，直接返回
                if (link.possiblyAmbiguous && isLinkToDisamTarget(title)) {
                    return link;
                }

                // 外层非目标，但 description 含嵌套链接，递归查找内层
                if (link.description && link.description.indexOf('[[') !== -1) {
                    var innerLink = extractLinkToPage(text, destinations, link.start + 2, link.bracketEnd - 2);
                    if (innerLink !== null) {
                        return innerLink;
                    }
                }

                lastIndex = link.end;
            }
        } while (link !== null);
        return null;
    };

    var variantLookupTable = {};

    var isLinkToDisamTarget = function (title) {
        return variantLookupTable.hasOwnProperty(title);
    };

    var buildVariantLookupTable = function (destinations, callback) {
        variantLookupTable = {};
        $.each(destinations, function (_, dest) {
            variantLookupTable[dest] = true;
        });

        var variants = ['zh-hans', 'zh-hant', 'zh-cn', 'zh-tw', 'zh-hk'];
        var totalRequests = destinations.length * variants.length;
        var completedRequests = 0;

        if (totalRequests === 0) {
            callback();
            return;
        }

        $.each(destinations, function (idx, dest) {
            $.each(variants, function (_, variant) {
                $.ajax({
                    url: mw.config.get('wgScriptPath') + '/api.php',
                    data: {
                        action: 'parse',
                        text: dest,
                        prop: 'text',
                        variant: variant,
                        format: 'json',
                    },
                    dataType: 'json',
                    type: 'POST',
                })
                    .done(function (data) {
                        if (data && data.parse && data.parse.text) {
                            var html = data.parse.text['*'];
                            var $html = $(html);
                            var convertedText = $html.text().trim();
                            if (convertedText && !variantLookupTable.hasOwnProperty(convertedText)) {
                                variantLookupTable[convertedText] = true;
                            }
                        }
                    })
                    .always(function () {
                        completedRequests++;
                        if (completedRequests === totalRequests) {
                            callback();
                        }
                    });
            });
        });
    };

    /*
     * Find the "target" page: either the one we are in or the "main" one found by extracting
     * the title from ".* (disambiguation)" or whatever the appropiate local format is
     */
    var getTargetPage = function () {
        var title = getTitle();
        return forceSamePage ? title : removeDisam(title);
    };

    /*
     * Get the page title, with the namespace prefix if any.
     */
    var getTitle = function () {
        return mw.config.get('wgPageName').replace(/_/g, ' ');
    };

    /*
     * Extract a "main" title from ".* (disambiguation)" or whatever the appropiate local format is
     */
    var removeDisam = function (title) {
        var match = new RegExp(cfg.disamRegExp).exec(title);
        return match ? match[1] : title;
    };

    /*
     * Check whether two page titles are the same
     */
    var isSamePage = function (title1, title2) {
        return getCanonicalTitle(title1) === getCanonicalTitle(title2);
    };

    /*
     * Return the 'canonical title' of a page
     */
    var getCanonicalTitle = function (title) {
        try {
            title = new mw.Title(title).getPrefixedText();
        } catch (ex) {
            // mw.Title seems to be buggy, and some valid titles are rejected
            // FIXME: This may cause false negatives
        }
        return title;
    };

    /*
     * Extract the context around a given link in a text string
     */
    var extractContext = function (text, link) {
        var contextStart = link.start - cfg.radius;
        var contextEnd = link.end + cfg.radius;
        var contextPrev = text.substring(contextStart, link.start);
        if (contextStart > 0) {
            contextPrev = txt.ellipsis + contextPrev;
        }
        var contextNext = text.substring(link.end, contextEnd);
        if (contextEnd < text.length) {
            contextNext = contextNext + txt.ellipsis;
        }
        return [contextPrev, text.substring(link.start, link.end), contextNext];
    };

    /*
     * Extract the prefixed page name from a link
     */
    var extractPageName = function (link) {
        var pageName = extractPageNameRaw(link);
        if (pageName) {
            var sectionPos = pageName.indexOf('#');
            var section = '';
            if (sectionPos !== -1) {
                section = pageName.substring(sectionPos);
                pageName = pageName.substring(0, sectionPos);
            }
            return getCanonicalTitle(pageName) + section;
        } else {
            return null;
        }
    };

    /*
     * Extract the page name from a link, as is
     */
    var extractPageNameRaw = function (link) {
        if (!link.hasClass('image')) {
            var href = link.attr('href');
            if (link.hasClass('new')) {
                // "Red" link
                if (href.indexOf(mw.config.get('wgScript')) === 0) {
                    return mw.util.getParamValue('title', href);
                }
            } else {
                var regex = mw.config.get('wgArticlePath').replace('$1', '(.*)');
                var regexResult = RegExp('^' + regex + '$').exec(href);
                if ($.isArray(regexResult) && regexResult.length > 1) {
                    return decodeURIComponent(regexResult[1]);
                }
            }
        }
        return null;
    };

    /*
     * Check whether this is a disambiguation page
     */
    var isDisam = function () {
        var categories = $('#catlinks ul li:not(.noprint)>a')
            .map((_, ele) => ele.textContent)
            .get();
        for (var ii = 0; ii < categories.length; ii++) {
            if ($.inArray(categories[ii], cfg.disamCategories) !== -1) {
                return true;
            }
        }
        return false;
    };

    var secondsToHHMMSS = function (totalSeconds) {
        var hhmmss = '';
        var hours = Math.floor(totalSeconds / 3600);
        var minutes = Math.floor((totalSeconds % 3600) / 60);
        var seconds = Math.floor((totalSeconds % 3600) % 60);
        if (hours >= 1) {
            hhmmss = pad(hours, '0', 2) + ':';
        }
        hhmmss += pad(minutes, '0', 2) + ':' + pad(seconds, '0', 2);
        return hhmmss;
    };

    var pad = function (str, z, width) {
        str = str.toString();
        if (str.length >= width) {
            return str;
        } else {
            return new Array(width - str.length + 1).join(z) + str;
        }
    };

    /*
     * Create a new button
     * text: Text that will be displayed on the button
     * onClick: Function that will be called when the button is clicked
     */
    var createButton = function (text, onClick) {
        var button = $('<input></input>', { type: 'button', value: text });
        button.addClass('disamassist-button').click(onClick);
        return button;
    };

    /*
     * Given a page title and an array of possible redirects {from, to} ("canonical titles"), find the page
     * at the end of the redirect chain, if there is one. Otherwise, return the page title that was passed
     */
    var resolveRedirect = function (pageTitle, possibleRedirects) {
        var appliedRedirect = true;
        var visitedPages = {};
        var currentPage = getCanonicalTitle(pageTitle);
        while (appliedRedirect) {
            appliedRedirect = false;
            for (var ii = 0; ii < possibleRedirects.length; ii++) {
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

    /*
     * Fetch the incoming links to a page. Returns a jQuery promise
     * (success - array of titles of pages that contain links to the target page and
     * array of "canonical titles" of possible destinations of the backlinks (either
     * the target page or redirects to the target page), failure - error description)
     * page: Target page
     */
    var getBacklinks = function (page) {
        var dfd = new $.Deferred();
        var api = new mw.Api();

        // 递归函数处理分页
        var fetchBacklinks = function (page, continueParam) {
            var params = {
                action: 'query',
                list: 'backlinks',
                bltitle: page,
                blredirect: true,
                bllimit: cfg.backlinkLimit,
                blnamespace: cfg.targetNamespaces.join('|'),
            };

            // 如果有continue参数，则添加到请求中
            if (continueParam) {
                params.blcontinue = continueParam.blcontinue;
                params.continue = continueParam.continue;
            }

            return api.get(params).then(function (data) {
                // 收集当前页的反向链接
                var backlinks = [];
                var linkTitles = [];

                $.each(data.query.backlinks, function () {
                    backlinks.push(this.title);
                    if (this.redirlinks) {
                        linkTitles.push(this.title);
                        $.each(this.redirlinks, function () {
                            backlinks.push(this.title);
                        });
                    }
                });

                // 检查是否有更多结果
                if (data.continue && data.continue.blcontinue) {
                    // 递归获取下一页结果
                    return fetchBacklinks(page, data.continue).then(function (nextResult) {
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
            .then(function (result) {
                dfd.resolve(result.backlinks, result.linkTitles);
            })
            .fail(function (code, data) {
                dfd.reject(txt.getBacklinksError.replace('$1', code));
            });

        return dfd.promise();
    };

    /*
     * Download a list of redirects for some pages. Returns a jQuery callback (success -
     * array of redirects ({from, to}), failure - error description )
     * pageTitles: Array of page titles
     */
    var fetchRedirects = function (pageTitles) {
        var dfd = new $.Deferred();
        var api = new mw.Api();
        var allRedirects = [];
        var fetchNext = function (index) {
            if (index >= pageTitles.length) {
                dfd.resolve(allRedirects);
                return;
            }
            api.get({
                action: 'query',
                titles: pageTitles[index],
                redirects: true,
            })
                .done(function (data) {
                    var theseRedirects = data.query.redirects ? data.query.redirects : [];
                    allRedirects = allRedirects.concat(theseRedirects);
                    fetchNext(index + 1);
                })
                .fail(function (code, data) {
                    dfd.reject(txt.fetchRedirectsError.replace('$1', code));
                });
        };
        fetchNext(0);
        return dfd.promise();
    };

    /*
     * Download the list of user rights for the current user. Returns a
     * jQuery promise (success - array of right names, error - error description)
     */
    var fetchRights = function () {
        var dfd = $.Deferred();
        var api = new mw.Api();
        api.get({
            action: 'query',
            meta: 'userinfo',
            uiprop: 'rights',
        })
            .done(function (data) {
                dfd.resolve(data.query.userinfo.rights);
            })
            .fail(function (code, data) {
                dfd.reject(txt.fetchRightsError.replace('$1', code));
            });
        return dfd.promise();
    };

    /*
     * Load the raw page text for a given title. Returns a jQuery promise (success - page
     * content, failure - error description)
     * pageTitle: Title of the page
     */
    var loadPage = function (pageTitle) {
        return loadPagesBatch([pageTitle]).then(function (results) {
            return results[pageTitle];
        });
    };

    /*
     * Load multiple pages at once. Returns a jQuery promise (success - mapping
     * of title to page data, failure - error description)
     * pageTitles: Array of page titles
     */
    var loadPagesBatch = function (pageTitles) {
        var dfd = new $.Deferred();
        if (pageTitles.length === 0) {
            dfd.resolve({});
            return dfd.promise();
        }
        var api = new mw.Api();
        api.get({
            action: 'query',
            titles: pageTitles.join('|'),
            prop: 'revisions',
            rvprop: 'timestamp|content',
            meta: 'tokens',
            type: 'csrf',
        })
            .done(function (data) {
                var pages = data.query.pages;
                var token = data.query.tokens.csrftoken;
                var results = {};
                for (var key in pages) {
                    if (!pages.hasOwnProperty(key)) {
                        continue;
                    }
                    var rawPage = pages[key];
                    var page = {};
                    var content = rawPage.revisions ? rawPage.revisions[0]['*'] : '';
                    page.redirect = rawPage.redirect !== undefined || /^\s*#(REDIRECT|重定向)\s*\[\[/i.test(content);
                    page.missing = rawPage.missing !== undefined;
                    if (rawPage.revisions) {
                        page.content = rawPage.revisions[0]['*'];
                        page.baseTimeStamp = rawPage.revisions[0].timestamp;
                    } else {
                        page.content = '';
                        page.baseTimeStamp = null;
                    }
                    page.startTimeStamp = rawPage.starttimestamp;
                    page.editToken = token;
                    results[rawPage.title] = page;
                }
                dfd.resolve(results);
            })
            .fail(function (code, data) {
                dfd.reject(txt.loadPageError.replace('$1', pageTitles.join(', ')).replace('$2', code));
            });
        return dfd.promise();
    };

    /*
     * Pre-fetch the next batch of pages from the links queue into pageCache.
     * callback: Optional function called when prefetch completes (success or failure)
     */
    var prefetchNextBatch = function (callback) {
        if (prefetchInProgress) {
            if (callback) {
                callback();
            }
            return;
        }
        var batch = [];
        for (var i = 0; i < links.length && batch.length < cfg.queryTitleLimit; i++) {
            if (!pageCache.hasOwnProperty(links[i])) {
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
            .done(function (results) {
                $.extend(pageCache, results);
                prefetchInProgress = false;
                if (callback) {
                    callback();
                }
            })
            .fail(function (description) {
                prefetchInProgress = false;
                if (callback) {
                    error(description);
                    callback();
                } else {
                    console.warn('[DisamAssist] prefetch failed:', description);
                }
            });
    };

    /*
     * Register changes to a page, to be saved later. Returns a jQuery promise
     * (success - no params, failure - error description). Takes the same parameters
     * as savePage
     */
    var saveWithCooldown = function () {
        var deferred = new $.Deferred();
        pendingSaves.push({ args: arguments, dfd: deferred });
        if (!runningSaves) {
            checkAndSave();
        }
        return deferred.promise();
    };

    /*
     * Save the first set of changes in the list of pending changes, providing that
     * enough time has passed since the last edit
     */
    var checkAndSave = function () {
        if (pendingSaves.length === 0) {
            runningSaves = false;
            return;
        }
        runningSaves = true;
        var millisSinceLast = new Date().getTime() - lastEditMillis;
        if (millisSinceLast < cfg.editCooldown * 1000) {
            setTimeout(checkAndSave, cfg.editCooldown * 1000 - millisSinceLast);
        } else {
            // The last edit started at least cfg.editCooldown seconds ago
            var save = pendingSaves.shift();
            savePage
                .apply(this, save.args)
                .done(function () {
                    checkAndSave();
                    save.dfd.resolve();
                })
                .fail(function (description) {
                    checkAndSave();
                    save.dfd.reject(description);
                });
            // We'll use the time since the last edit started
            lastEditMillis = new Date().getTime();
        }
    };

    /*
     * Save the changes made to a page. Returns a jQuery promise (success - no params,
     * failure - error description)
     * pageTitle: Title of the page
     * page: Page data
     * summary: Summary of the changes made to the page
     * minorEdit: Whether to mark the edit as 'minor'
     * botEdit: Whether to mark the edit as 'bot'
     */
    var savePage = function (pageTitle, page, summary, minorEdit, botEdit) {
        var dfd = new $.Deferred();
        var api = new mw.Api();
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
        })
            .done(function () {
                dfd.resolve();
            })
            .fail(function (code, data) {
                dfd.reject(txt.savePageError.replace('$1', pageTitle).replace('$2', code));
            });
        return dfd.promise();
    };

    install();
})(mediaWiki, jQuery);
