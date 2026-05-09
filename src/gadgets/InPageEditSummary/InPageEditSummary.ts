interface SummaryItem {
    summary: string;
    label: string;
}

declare global {
    interface Window {
        IPESummary?: (string | Partial<SummaryItem>)[];
    }
}

mw.hook('InPageEdit').add(IPEQuickSummary);

function IPEQuickSummary(): void {
    const observer = new MutationObserver(() => {
        const $label = $('label[for="editSummary"]') as JQuery<HTMLLabelElement>;
        const $input = $('#editSummary') as JQuery<HTMLInputElement>;

        if ($label.length && $input.length && !$label.next('#mysummary').length) {
            summaryBox($label, $input);
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
    });
}

function summaryBox($label: JQuery<HTMLLabelElement>, $input: JQuery<HTMLInputElement>): void {
    const $box = $('<div>', {
        id: 'mysummary',
        text: '快速摘要：',
    }) as JQuery<HTMLDivElement>;

    $label.after($box);

    if (!Array.isArray(window.IPESummary)) {
        return;
    }

    const summaries = window.IPESummary;

    summaries.forEach((item, i) => {
        const summaryItem: SummaryItem = typeof item === 'string' ? { summary: item, label: item } : { summary: item.summary || item.label || '', label: item.label || item.summary || '' };

        const $btn = $('<a>', {
            href: '#',
            text: summaryItem.label,
            title: summaryItem.summary,
        }) as JQuery<HTMLAnchorElement>;

        $btn.on('click', (e: JQuery.ClickEvent) => {
            e.preventDefault();

            const newValue = insertSummary($input.val() || '', summaryItem.summary);
            $input.val(newValue).focus();
        });

        $box.append($btn);

        if (i < summaries.length - 1) {
            $box.append(' | ');
        }
    });
}

function insertSummary(current: string, text: string): string {
    const sectionMatch = current.match(/(\/\*.*?\*\/)/);

    if (sectionMatch) {
        const pos = sectionMatch.index! + sectionMatch[0].length;
        return `${current.slice(0, pos)} ${text}${current.slice(pos)}`;
    }

    const viaIPE = current.indexOf('//');

    if (viaIPE !== -1) {
        return `${current.slice(0, viaIPE).replace(/\s*$/, ' ')}${text} ${current.slice(viaIPE)}`;
    }

    if (current && !/\s$/.test(current)) {
        return `${current} ${text}`;
    }

    return current + text;
}

window.IPESummary = window.IPESummary || ['修饰语句', '修正笔误', '内容扩充', '排版', '内部链接', '分类', '消歧义', '萌百化'];
