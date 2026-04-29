/* global oouiDialog */
$(() => {
    const { wgNamespaceNumber, wgIsArticle } = mw.config.get();
    if (wgNamespaceNumber !== 2 || !wgIsArticle) {
        return;
    }

    const loadingPromise = mw.loader.using(["oojs-ui", "mediawiki.api", "ext.gadget.libHashwasm", "ext.gadget.libOOUIDialog"]);

    /** 通过用户昵称查询用户名 */
    const getUsernameByDisplayName = async displayname => {
        const api = new mw.Api();

        // 1. 用昵称查 userid
        const dnResult = await api.post({
            action: "moedisplayname",
            format: "json",
            op: "get",
            displayname,
            formatversion: "2",
        });
        const list = dnResult?.displaynames ?? [];
        if (list.length === 0) {
            throw new Error(`未找到昵称为"${displayname}"的用户。`);
        }
        const { userid } = list[0];

        // 2. 用 userid 查实际用户名
        const userResult = await api.post({
            action: "query",
            list: "users",
            ususerids: userid,
            formatversion: 2,
        });
        const username = userResult?.query?.users?.[0]?.name;
        if (!username) {
            throw new Error(`无法通过用户ID ${userid} 获取用户名。`);
        }
        return username;
    };

    /** 通过用户名获取 QQHash */
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

    /** 构建输入面板 */
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
        const makeHint = text => $("<div>").css({ fontSize: "0.85em", color: "#54595d", margin: "0.1em 0 0.3em" }).text(text);

        const $usernameInput = makeInput("qqhash-username", "留空则使用昵称查询");
        const $displaynameInput = makeInput("qqhash-displayname", "留空则使用用户名查询");
        const $qqInput = makeInput("qqhash-qq", "请输入QQ号码");

        const $panel = $("<div>")
            .css({ padding: "0.2em 0" })
            .append(
                makeLabel("用户名"),
                makeHint("与下方昵称二选一，优先使用用户名"),
                $usernameInput,
                makeLabel("用户昵称（显示名）"),
                makeHint("填写萌娘百科的显示名称，用户名留空时生效"),
                $displaynameInput,
                makeLabel("QQ号码"),
                $qqInput,
            );

        return { $panel, $usernameInput, $displaynameInput, $qqInput };
    };

    const openDialog = async () => {
        await loadingPromise;

        const { $panel, $usernameInput, $displaynameInput, $qqInput } = createPanel();

        const confirmed = await oouiDialog.confirm($panel, {
            title: "QQ号码哈希验证",
            size: "medium",
        });

        if (!confirmed) {
            return;
        }

        const usernameRaw = $usernameInput.val().trim();
        const displaynameRaw = $displaynameInput.val().trim();
        const qq = $qqInput.val().trim();

        if (!usernameRaw && !displaynameRaw) {
            await oouiDialog.alert("请输入用户名或用户昵称！", { title: "输入有误", size: "medium" });
            return;
        }
        if (!/^[1-9]\d{4,9}$/.test(qq)) {
            await oouiDialog.alert("请输入合法的QQ号码（5~10位数字）！", { title: "输入有误", size: "medium" });
            return;
        }

        try {
            // 解析最终用户名
            let username = usernameRaw;
            if (!username) {
                // 通过昵称查询
                username = await getUsernameByDisplayName(displaynameRaw);
            }

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
            await oouiDialog.alert(`验证失败：${oouiDialog.sanitize(err.message ?? String(err))}`, { title: "出错了", size: "medium" });
        }
    };

    const portletLink = mw.util.addPortletLink("p-cactions", "#", "QQ验证", "ca-qqhash-verify", "验证用户的QQ号码哈希");
    if (portletLink) {
        portletLink.querySelector("a").addEventListener("click", e => {
            e.preventDefault();
            openDialog();
        });
    }
});
