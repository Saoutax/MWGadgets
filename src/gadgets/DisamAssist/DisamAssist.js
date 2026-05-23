import './modules/styles.css';

(() => {
    const CONFIG = {
        disamCategory: '消歧义页',
        disamSuffix: '(消歧义页)',
        targetNamespaces: [0],
        contextRadius: 80,
        autoSubmitDelay: 30000,
        undoLimit: 500,
    };

    const { wgCategories, wgPageName, wgIsArticle } = mw.config.get();

    let running = false;
    let targetPage = '';
    let possibleTargets = [];
    let pendingPages = [];
    let currentPageTitle = '';
    let currentPageData = null;
    let currentLink = null;
    let undoStack = [];
    let pageDataStore = new Map();
    let displayedPages = new Set();
    let editCount = 0;
    let pendingEditCount = 0;
    let panel = null;
    let optionMarkers = [];
    let autoSubmitTimer = null;
    const api = new mw.Api();

    const canonicalTitle = title => {
        try {
            return new mw.Title(title).getPrefixedText();
        } catch {
            return title;
        }
    };

    const extractPageName = linkEl => {
        const titleAttr = linkEl.getAttribute('title');
        if (titleAttr) {
            return canonicalTitle(titleAttr) || null;
        }
        const url = new URL(linkEl.href, location.origin);
        const pageTitle = decodeURIComponent(url.searchParams.get('title') || url.pathname.slice(1));
        return canonicalTitle(pageTitle) || null;
    };

    const replaceLink = (text, link, newTitle) => {
        const inner =
            canonicalTitle(newTitle) === canonicalTitle(link.displayText)
                ? link.displayText
                : `${newTitle}|${link.displayText}`;
        return text.slice(0, link.start) + `[[${inner}]]` + text.slice(link.end);
    };

    const removeLink = (text, link) => {
        return text.slice(0, link.start) + link.displayText + text.slice(link.end);
    };

    const contextAround = (text, link) => {
        const radius = CONFIG.contextRadius;
        const start = Math.max(0, link.start - radius);
        const end = Math.min(text.length, link.end + radius);
        const before = start > 0 ? `…${text.slice(start, link.start)}` : text.slice(start, link.start);
        const after = end < text.length ? `${text.slice(link.end, end)}…` : text.slice(link.end, end);
        return [before, text.slice(link.start, link.end), after];
    };

    const findLink = (text, startIndex = 0) => {
        const regex = /\[\[([^[\]]+?)(?:\|([^[\]]*?))?\]\]/g;
        regex.lastIndex = startIndex;
        let match;
        while ((match = regex.exec(text)) !== null) {
            const title = match[1].trim();
            if (!title) {
                continue;
            }
            const normalized = canonicalTitle(title);
            if (normalized && possibleTargets.includes(normalized)) {
                return {
                    start: match.index,
                    end: regex.lastIndex,
                    title,
                    displayText: (match[2] || title).trim(),
                };
            }
        }
        return null;
    };

    const fetchBacklinks = async page => {
        const titles = [];
        const targets = [canonicalTitle(page)];
        let continueParam = {};

        do {
            const result = await api.post({
                action: 'query',
                list: 'backlinks',
                bltitle: page,
                blredirect: true,
                bllimit: 'max',
                blnamespace: CONFIG.targetNamespaces.join('|'),
                formatversion: 2,
                ...continueParam,
            });
            const { backlinks } = result.query;
            for (const { title, redirlinks } of backlinks) {
                titles.push(title);
                targets.push(canonicalTitle(title));
                if (redirlinks) {
                    for (const redirectLink of redirlinks) {
                        titles.push(redirectLink.title);
                    }
                }
            }
            continueParam = result.continue?.blcontinue
                ? { blcontinue: result.continue.blcontinue }
                : {};
        } while (continueParam.blcontinue);

        return { titles, targets };
    };

    const loadPage = async title => {
        const {
            query: { pages },
        } = await api.post({
            action: 'query',
            titles: title,
            prop: 'revisions',
            rvprop: 'timestamp|content',
            curtimestamp: true,
            formatversion: 2,
        });
        const pageData = pages[0];
        if (pageData.missing || pageData.invalid) {
            return null;
        }
        const revision = pageData.revisions?.[0];
        return {
            content: revision?.content ?? '',
            timestamp: revision?.timestamp ?? null,
            starttimestamp: pageData.starttimestamp ?? null,
        };
    };

    const saveEdit = async (title, content, pageData, summary) => {
        await api.postWithToken('csrf', {
            action: 'edit',
            title,
            text: content,
            summary,
            basetimestamp: pageData.timestamp,
            starttimestamp: pageData.starttimestamp,
            tags: 'Automation tool',
            minor: true,
        });
    };

    const markDisamOptions = () => {
        removeOptionMarkers();
        document.querySelectorAll('#mw-content-text ul > li').forEach(listItem => {
            const linkEl = listItem.querySelector('a');
            if (!linkEl) {
                return;
            }
            const pageName = extractPageName(linkEl);
            if (!pageName) {
                return;
            }
            const marker = document.createElement('a');
            marker.href = '#';
            marker.className = 'disamassist-optionmarker';
            marker.textContent = '⇨';
            marker.title = `替换为「${pageName}」`;
            marker.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                if (running && currentLink) {
                    chooseReplacement(pageName);
                }
            });
            linkEl.parentNode?.insertBefore(marker, linkEl.nextSibling);
            optionMarkers.push(marker);
        });
    };

    const removeOptionMarkers = () => {
        optionMarkers.forEach(marker => {
            marker.remove();
        });
        optionMarkers = [];
    };

    /** 替换当前链接为目标标题，记录变更，自动前进 */
    const chooseReplacement = newTitle => {
        if (!currentLink) {
            return;
        }
        const before = currentPageData.content;
        currentPageData.content = replaceLink(currentPageData.content, currentLink, newTitle);
        undoStack.push({
            pageTitle: currentPageTitle,
            contentBefore: before,
            link: { ...currentLink },
            summary: `消歧义：[[${newTitle}]]`,
        });
        pendingEditCount++;
        if (undoStack.length > CONFIG.undoLimit) {
            undoStack.shift();
        }
        const stored = pageDataStore.get(currentPageTitle);
        if (stored) {
            stored.content = currentPageData.content;
        }
        updatePanel();
        resetAutoSubmit();
        advanceToNext();
    };

    /** 移除当前链接（仅保留显示文本），记录变更，自动前进 */
    const chooseRemoval = () => {
        if (!currentLink) {
            return;
        }
        const before = currentPageData.content;
        currentPageData.content = removeLink(currentPageData.content, currentLink);
        undoStack.push({
            pageTitle: currentPageTitle,
            contentBefore: before,
            link: { ...currentLink },
            summary: '移除消歧义链接',
        });
        pendingEditCount++;
        if (undoStack.length > CONFIG.undoLimit) {
            undoStack.shift();
        }
        const stored = pageDataStore.get(currentPageTitle);
        if (stored) {
            stored.content = currentPageData.content;
        }
        updatePanel();
        resetAutoSubmit();
        advanceToNext();
    };

    /** 撤销上一次操作并回到之前的链接 */
    const goBack = () => {
        if (undoStack.length === 0) {
            return;
        }
        const last = undoStack.pop();
        if (last.summary !== '跳过') {
            pendingEditCount = Math.max(0, pendingEditCount - 1);
        }

        if (last.pageTitle !== currentPageTitle) {
            const prevTitle = currentPageTitle;
            const targetData = pageDataStore.get(last.pageTitle);
            if (!targetData) {
                undoStack.push(last);
                return;
            }
            currentPageTitle = last.pageTitle;
            currentPageData = { ...targetData };
            currentPageData.content = last.contentBefore;
            currentLink = { ...last.link };
            displayedPages.delete(prevTitle);
            pendingPages.unshift(prevTitle);
        } else {
            currentPageData.content = last.contentBefore;
            currentLink = { ...last.link };
        }
        showCurrentLink();
        updatePanel();
    };

    /** 批量提交所有更改 */
    const submitAll = async () => {
        clearTimeout(autoSubmitTimer);
        if (pendingEditCount === 0) {
            mw.notify('没有待提交的更改', { type: 'info' });
            return;
        }
        panel.enableActions(false);
        mw.notify(`正在提交 ${pendingEditCount} 项更改…`, { type: 'info' });

        let successCount = 0;
        for (const [title, pageData] of pageDataStore) {
            // 收集该页面所有非跳过的摘要
            const summaries = undoStack
                .filter(entry => {
                    return entry.pageTitle === title && entry.summary !== '跳过';
                })
                .map(entry => {
                    return entry.summary;
                });
            if (summaries.length === 0) {
                continue;
            }

            // 检查内容是否真的有变动：取第一个 undo 记录的 contentBefore 对比当前
            const contentBefore = undoStack.find(entry => {
                return entry.pageTitle === title;
            })?.contentBefore;
            if (contentBefore === undefined || contentBefore === pageData.content) {
                continue;
            }

            try {
                const summary = `DisamAssist：[[${targetPage}]] - ${summaries.join('；')}`;
                await saveEdit(title, pageData.content, pageData, summary);
                successCount++;
                editCount++;
            } catch (error) {
                console.error('[DisamAssist] 保存失败：', title, error);
                mw.notify(`保存「${title}」失败`, { type: 'error' });
            }
        }

        if (successCount > 0) {
            mw.notify(`已提交 ${successCount} 页的更改`, { type: 'success' });
            pendingEditCount = 0;
            updatePanel();
        }
        panel.enableActions(true);
    };

    const resetAutoSubmit = () => {
        clearTimeout(autoSubmitTimer);
        if (pendingEditCount > 0) {
            autoSubmitTimer = setTimeout(submitAll, CONFIG.autoSubmitDelay);
        }
    };

    const createPanel = () => {
        const box = document.createElement('div');
        box.className = 'disamassist-box';
        box.style.display = 'none';

        const header = document.createElement('div');
        header.className = 'disamassist-header';
        const ctx = document.createElement('div');
        ctx.className = 'disamassist-ctx';
        const info = document.createElement('span');
        info.className = 'disamassist-info';

        const createButton = (text, className) => {
            const button = document.createElement('button');
            button.textContent = text;
            if (className) {
                button.className = className;
            }
            return button;
        };

        const buttons = {
            prev: createButton('← 上一个'),
            next: createButton('下一个 →'),
            remove: createButton('移除链接'),
            submit: createButton('提交', 'd-primary'),
            close: createButton('结束', 'd-danger'),
        };
        buttons.prev.disabled = true;
        buttons.submit.disabled = true;

        const actions = document.createElement('div');
        actions.className = 'disamassist-actions';
        actions.append(buttons.prev, buttons.next, buttons.remove, info, buttons.submit, buttons.close);
        box.append(header, ctx, actions);

        const contentArea = document.getElementById('mw-content-text');
        if (contentArea?.parentNode) {
            contentArea.parentNode.insertBefore(box, contentArea);
        } else {
            document.body.prepend(box);
        }

        return {
            box,
            buttons,
            show() {
                box.style.display = '';
            },
            destroy() {
                box.remove();
            },
            setPage(title) {
                header.textContent = '页面：';
                const link = document.createElement('a');
                link.href = mw.util.getUrl(title, { redirect: 'no' });
                link.textContent = title;
                header.append(link);
            },
            setContext(parts) {
                ctx.textContent = '';
                ctx.style.display = '';
                const highlightEl = document.createElement('span');
                highlightEl.className = 'disamassist-hl';
                highlightEl.textContent = parts[1];
                ctx.append(document.createTextNode(parts[0]), highlightEl, document.createTextNode(parts[2]));
            },
            showMessage(msg) {
                ctx.textContent = msg;
            },
            showDone() {
                header.textContent = '✓ 全部处理完成';
                ctx.style.display = 'none';
            },
            setInfo(text) {
                info.textContent = text;
            },
            enableActions(enabled) {
                buttons.prev.disabled = !enabled;
                buttons.next.disabled = !enabled;
                buttons.remove.disabled = !enabled;
            },
            setSubmitEnabled(enabled) {
                buttons.submit.disabled = !enabled;
            },
        };
    };

    const updatePanel = () => {
        panel.setInfo(pendingEditCount > 0 ? `待提交: ${pendingEditCount} 项` : '');
        panel.setSubmitEnabled(pendingEditCount > 0);
    };

    const showCurrentLink = () => {
        if (!currentLink) {
            return;
        }
        panel.setContext(contextAround(currentPageData.content, currentLink));
        panel.setPage(currentPageTitle);
        panel.enableActions(true);
    };

    const processNextPage = async () => {
        while (pendingPages.length > 0 && displayedPages.has(pendingPages[0])) {
            pendingPages.shift();
        }
        if (pendingPages.length === 0) {
            panel.enableActions(false);
            panel.showDone();
            return;
        }
        const title = pendingPages.shift();
        displayedPages.add(title);
        currentPageTitle = title;
        panel.enableActions(false);
        panel.setPage(title);

        try {
            currentPageData = await loadPage(title);
            if (!running) { return; }
            if (!currentPageData) {
                await processNextPage();
                return;
            }
            pageDataStore.set(title, { ...currentPageData });
            currentLink = findLink(currentPageData.content, 0);
            if (currentLink) {
                showCurrentLink();
            } else {
                await processNextPage();
            }
        } catch (error) {
            console.error('[DisamAssist] 加载失败：', title, error);
            if (!running) { return; }
            await processNextPage();
        }
    };

    const advanceToNext = () => {
        if (!currentLink) {
            processNextPage();
            return;
        }
        const nextLink = findLink(currentPageData.content, currentLink.end);
        if (nextLink) {
            currentLink = nextLink;
            showCurrentLink();
        } else {
            processNextPage();
        }
    };

    const start = async target => {
        if (running) {
            mw.notify('DisamAssist 已在运行', { type: 'warn' });
            return;
        }
        running = true;

        targetPage = target;
        possibleTargets = [];
        pendingPages = [];
        currentPageTitle = '';
        currentPageData = null;
        currentLink = null;
        undoStack = [];
        pageDataStore = new Map();
        displayedPages = new Set();
        editCount = 0;
        pendingEditCount = 0;
        clearTimeout(autoSubmitTimer);

        mw.notify('正在获取链入页面…', { type: 'info' });

        try {
            const { titles, targets } = await fetchBacklinks(targetPage);
            if (titles.length === 0) {
                mw.notify('没有找到链入页面', { type: 'info' });
                end();
                return;
            }
            possibleTargets = [...new Set(targets)];
            pendingPages = titles;

            panel = createPanel();
            panel.buttons.prev.onclick = () => {
                goBack();
                resetAutoSubmit();
            };
            panel.buttons.next.onclick = () => {
                if (!currentLink) {
                    return;
                }
                undoStack.push({
                    pageTitle: currentPageTitle,
                    contentBefore: currentPageData.content,
                    link: { ...currentLink },
                    summary: '跳过',
                });
                if (undoStack.length > CONFIG.undoLimit) {
                    undoStack.shift();
                }
                advanceToNext();
                updatePanel();
                resetAutoSubmit();
            };
            panel.buttons.remove.onclick = () => {
                chooseRemoval();
                resetAutoSubmit();
            };
            panel.buttons.submit.onclick = submitAll;
            panel.buttons.close.onclick = () => {
                if (pendingEditCount > 0 && !confirm('有未提交的更改，确定要结束吗？')) {
                    return;
                }
                end();
            };

            panel.show();
            panel.enableActions(false);
            markDisamOptions();
            await processNextPage();
        } catch (error) {
            mw.notify('获取链入页面失败', { type: 'error' });
            console.error('[DisamAssist]', error);
            end();
        }
    };

    const end = () => {
        running = false;
        clearTimeout(autoSubmitTimer);
        removeOptionMarkers();
        if (panel) {
            panel.destroy();
            panel = null;
        }
        if (editCount > 0) {
            mw.notify(`消歧义完成，共编辑 ${editCount} 页`, { type: 'success' });
        }
    };

    const install = async () => {
        if (!wgIsArticle || !wgCategories?.includes(CONFIG.disamCategory)) {
            return;
        }

        await mw.loader.using(['mediawiki.Title', 'mediawiki.api', 'mediawiki.util']);

        const addLink = (label, id, tooltip, target) => {
            mw.util.addPortletLink('p-cactions', '#', label, id, tooltip)?.addEventListener('click', event => {
                event.preventDefault();
                start(target);
            });
        };

        if (wgPageName.endsWith(CONFIG.disamSuffix)) {
            const main = wgPageName.slice(0, -CONFIG.disamSuffix.length);
            addLink('开始消歧义', 'ca-disamassist', '修复指向主条目的链接', main);
            addLink('消歧义链入页面', 'ca-disamassist-same', '修复指向当前页面的链接', wgPageName);
        } else {
            addLink('消歧义链入页面', 'ca-disamassist-page', '修复指向当前页面的链接', wgPageName);
        }
    };

    install();
})();
