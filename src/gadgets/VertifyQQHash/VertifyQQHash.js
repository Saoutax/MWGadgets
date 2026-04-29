/* global oouiDialog */
$(() => {
    const { wgNamespaceNumber, wgIsArticle } = mw.config.get();
    if (wgNamespaceNumber !== 2 || !wgIsArticle) {
        return;
    }

    const loadingPromise = mw.loader.using(["oojs-ui", "mediawiki.api", "ext.gadget.libHashwasm", "ext.gadget.libOOUIDialog"]);

    const getQQHash = async username => {
        const { query: { pages: [{ revisions: [{ content = "" } = {}] = [] }] = [] } = {} } = await new mw.Api().post({
            action: "query",
            titles: `User:${username}/QQHash`,
            prop: "revisions",
            rvprop: "content",
            formatversion: 2,
        });
        const match = content.match(/\{\{QQHash\s*\|\s*([\da-f]{128})\s*\}\}/i);
        return match ? match[1] : null;
    };

    const createPanel = () => {
        const makeLabel = text => $("<div>").css({ fontWeight: "bold", margin: ".6em 0 .2em" }).text(text);
        const makeInput = (id, placeholder) =>
            $("<input>").attr({ type: "text", id, placeholder }).css({
                width: "100%",
                boxSizing: "border-box",
                padding: "0.4em 0.5em",
                fontSize: "1em",
                border: "1px solid #a2a9b1",
                borderRadius: "2px",
                marginBottom: "0.2em",
            });

        const $usernameInput = makeInput("qqhash-username", "请输入用户名");
        const $qqInput = makeInput("qqhash-qq", "请输入QQ号码");

        const $panel = $("<div>").css({ padding: "0.2em 0" }).append(makeLabel("用户名"), $usernameInput, makeLabel("QQ号码"), $qqInput);

        return { $panel, $usernameInput, $qqInput };
    };

    const openDialog = async () => {
        await loadingPromise;

        const { $panel, $usernameInput, $qqInput } = createPanel();

        const confirmed = await oouiDialog.confirm($panel, {
            title: "QQ号码哈希验证",
            size: "medium",
        });

        if (!confirmed) {
            return;
        }

        const username = $usernameInput.val().trim();
        const qq = $qqInput.val().trim();

        if (!username) {
            await oouiDialog.alert("请输入用户名！", { title: "输入有误", size: "medium" });
            return;
        }
        if (!/^[1-9]\d{4,9}$/.test(qq)) {
            await oouiDialog.alert("请输入合法的QQ号码（5~10位数字）！", { title: "输入有误", size: "medium" });
            return;
        }

        try {
            const qqHash = await getQQHash(username);
            if (!qqHash) {
                await oouiDialog.alert(`未找到用户 ${oouiDialog.sanitize(username)} 的QQHash页面，或内容格式不正确。`, { title: "未找到记录", size: "medium" });
                return;
            }

            // eslint-disable-next-line no-undef
            const computed = await hashwasm.sha3(`MoegirlPediaUserQQHash-${username}-${qq}`, 512);
            const isMatch = computed === qqHash.toLowerCase();

            await oouiDialog.alert(`您输入的QQ号码与用户 ${oouiDialog.sanitize(username)} 的哈希记录<strong>${isMatch ? "相符" : "不符"}</strong>！`, {
                title: isMatch ? "✅ 验证通过" : "❌ 验证失败",
                size: "medium",
            });
        } catch (err) {
            await oouiDialog.alert(`获取页面失败，请检查用户名是否存在。<br><small>${oouiDialog.sanitize(err.message ?? String(err))}</small>`, { title: "请求出错", size: "medium" });
        }
    };

    const portletLink = mw.util.addPortletLink("p-cactions", "#", "验证QQHash", "ca-qqhash-verify", "验证用户的QQ号码哈希");
    if (portletLink) {
        portletLink.querySelector("a").addEventListener("click", e => {
            e.preventDefault();
            openDialog();
        });
    }
});
