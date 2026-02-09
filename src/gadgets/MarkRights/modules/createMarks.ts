function createMarks(userGroups: Record<string, string[]> | undefined, groupsList: GroupsList) {
    if (!userGroups) {
        return;
    }

    document.querySelectorAll("a.mw-userlink").forEach(link => {
        const href = link.getAttribute("href");
        const user = decodeURIComponent(href!.match(/\/User:([^/?#]+)/)![1] || "");

        const groups = userGroups[user];
        if (!groups?.length) {
            return;
        }

        const groupSet = new Set(groups);
        const container = document.createElement("sup");
        container.style.fontSize = "85%";
        container.style.verticalAlign = "super";
        container.style.marginLeft = "2px";
        container.style.lineHeight = "1";
        let hasAny = false;

        for (const group of Object.keys(groupsList)) {
            if (!groupSet.has(group)) {
                continue;
            }

            const meta = groupsList[group]!;
            const span = document.createElement("span");
            span.textContent = meta.label;
            span.style.color = meta.color;
            span.style.cursor = "help";
            span.style.marginLeft = hasAny ? "margin-left: 2px;" : "";
            span.title = meta.name;

            container.appendChild(span);
            hasAny = true;
        }
        if (hasAny) {
            link.after(container);
        }

    });
}

export { createMarks };
