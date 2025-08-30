mw.hook("InPageEdit").add(IPEQuickSummary);

function IPEQuickSummary() {
    const observer = new MutationObserver(() => {
        const $label = $("label[for='editSummary']");
        const $input = $("#editSummary");

        if ($label.length && $input.length && !$label.next("#mysummary").length) {
            summaryBox($label, $input);
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

function summaryBox($label, $input) {
    const $box = $("<div>", { id: "mysummary", text: "自定义摘要：" });
    $label.after($box);

    if (!Array.isArray(IPESummary)) {
        return;
    }

    IPESummary.forEach((item, i) => {
        const summaryItem = typeof item === "string" 
            ? { summary: item, label: item } 
            : { summary: item.summary || item.label || "", label: item.label || item.summary || "" };

        const $btn = $("<a>", {
            href: "#",
            text: summaryItem.label,
            title: summaryItem.summary
        }).on("click", e => {
            e.preventDefault();
            $input.val(insertSummary($input.val() || "", summaryItem.summary)).focus();
        });

        $box.append($btn);
        if (i < IPESummary.length - 1) $box.append(" | ");
    });
}

function insertSummary(current, text) {
    const section = current.match(/(\/\*.*?\*\/)/);
    if (section) {
        const pos = section.index + section[0].length;
        return `${current.slice(0, pos)} ${text}${current.slice(pos)}`;
    }

    const viaIPE = current.indexOf("//");
    if (viaIPE !== -1) {
        return `${current.slice(0, viaIPE).replace(/\s*$/, " ")}${text} ${current.slice(viaIPE)}`;
    }

    return current && !/\s$/.test(current) ? `${current} ${text}` : `${current || ""}${text}`;
}

window.IPESummary = window.IPESummary || [
    '修饰语句',
    '修正笔误',
    '内容扩充',
    '排版',
    '内部链接',
    '分类',
    '消歧义',
    '萌百化',
  ];