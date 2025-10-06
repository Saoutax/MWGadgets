$(() => {
	if (
		mw.config.get("wgNamespaceNumber") !== -1 &&
		!["submit", "edit"].includes(mw.config.get("wgAction")) &&
		$(".moe-img-error").length
	) {
		const title = mw.config.get("wgPageName").replace(/_/g, " ");
		new mw.Api().post({
			action: "query",
			prop: "revisions",
			rvprop: "content",
			titles: title,
			formatversion: 2
		}).then(data => {
			const page = data.query.pages[0];
			const content = page.revisions?.[0]?.content || "";

			$(".moe-img-error").toArray().forEach(($el, index) => {
				const $this = $($el);
				const src = $this.attr("data-src-input");

				const imgRegex = new RegExp(`<img[^>]*src=["']${src.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]*>`, "gi");
				const matches = Array.from(content.matchAll(imgRegex));
				const targetMatch = matches[index]?.[0];

				let styleAttr = "";
				let originalTitle = "";
				if (targetMatch) {
					const styleMatch = targetMatch.match(/style=["']([^"']+)["']/i);
					styleAttr = styleMatch?.[1] || "";

					const titleMatch = targetMatch.match(/title=["']([^"']+)["']/i);
					originalTitle = titleMatch?.[1] || "";
				}

				const img = new Image();
				img.onload = () => {
					if (styleAttr) img.style.cssText = styleAttr;
					img.title = originalTitle ? `「ExtImgRestore」${originalTitle}` : "ExtImgRestore";
					$this.replaceWith(img);
				};
				img.src = src;
				img.alt = src;
			});
		});
	}
});
