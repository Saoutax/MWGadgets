$(() => {
	if ( mw.config.get("wgNamespaceNumber") !== -1 && ($(".moe-img-error").length > 0 || $(".moe-img-blocked").length > 0) ) {
		const title = mw.config.get("wgPageName").replace(/_/g, " ");
		new mw.Api().post({
			action: "query",
			prop: "revisions",
			rvprop: "content",
			titles: title,
			formatversion: 2
		}).then((data) => {
			const page = data.query.pages[0];
			const content = page.revisions?.[0]?.content || "";

			$(".moe-img-error, .moe-img-blocked").each(function (index) {
				const $this = $(this);
				const isLink = $this.is("a");
				const src = isLink ? $this.attr("href") : $this.attr("data-src-input");

				const imgRegex = new RegExp(`<img[^>]*src=["']${src.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>`, "gi");
				const matches = [...content.matchAll(imgRegex)];
				const targetMatch = matches[index]?.[0] || null;

				let styleAttr = "";
				if (targetMatch) {
					const styleMatch = targetMatch.match(/style=["']([^"']+)["']/i);
					styleAttr = styleMatch?.[1] || "";
				}

				const img = new Image();
				img.onload = function () {
					if (styleAttr) {
						$(this).attr("style", styleAttr);
					}

					if (isLink) {
						const link = $("<a>").attr({
							href: src,
							target: $this.attr("target") || "_blank",
							rel: $this.attr("rel") || "noopener noreferrer",
							class: $this.attr("class") || "",
							title: $this.attr("title") || ""
						}).append(this);
						$this.replaceWith(link);
					} else {
						$this.replaceWith(this);
					}
				};
				img.src = src;
				img.alt = src;
			});
		});
	}
});
