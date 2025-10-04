mw.loader.using(["mediawiki.api", "@wikimedia/codex"]).then(function (require) {
    const ns = mw.config.get("wgNamespaceNumber");
    const special = mw.config.get("wgCanonicalSpecialPageName");
    if (![1, 2, -1].includes(ns) || (ns === -1 && !["Contributions", "DeletedContributions", "Block", "Log"].includes(special))) {
        return;
    }
    const dialogTrigger = mw.util.addPortletLink("p-cactions", "#", "向用户发送提醒", "p-usermessages");
	const Vue = require("vue");
	const Codex = require("@wikimedia/codex");
	const mountPoint = document.body.appendChild(document.createElement("div"));
	const api = new mw.Api();

	mw.util.addCSS(`
		.umdev-dialog-content {
			max-height: 70vh;
			overflow-y: auto;
			padding-right: 8px;
		}
		.umdev-textarea textarea {
			resize: vertical !important;
			max-height: 400px;
			overflow-y: auto !important;
		}
	`);

	Vue.createMwApp({
		data() {
			return {
				showDialog: false,
				selected: null,
				editSummary: "",
				showPreview: false,
				previewHtml: "",
				previewWikitext: "",
				parameterValues: {},
				customMode: false,
				customText: "",
				loadingSource: false,
				sending: false,
				templates: [
                    {
                        title: "欢迎",
                        template: "Template:UserMessages/Welcome",
                        parameters: [],
                        summary: "Welcome to Moegirlpedia~"
                    },
                    {
                        title: "优质编辑者",
                        template: "Template:UserMessages/GoodEditor",
                        parameters: [
                            { key: "1", label: "选填原因" }
                        ],
                        summary: "恭喜您成为萌娘百科优质编辑者！"
                    },
                    {
                        title: "可收录页面打回",
                        template: "Template:UserMessages/MovedToUserSubpage",
                        parameters: [
                            { key: "1", label: "页面名" },
                            { key: "2", label: "原因" }
                        ],
                        summary: "页面打回通知"
                    },
                    {
                        title: "非收录页面打回",
                        template: "Template:UserMessages/MovedToUserSubpage2",
                        parameters: [
                            { key: "1", label: "页面名" },
                            { key: "2", label: "原因" }
                        ],
                        summary: "页面打回通知"
                    },
                    {
                        title: "著作权侵犯",
                        template: "Template:UserMessages/ArticleCopyright",
                        parameters: [
                            { key: "1", label: "页面名" },
                            { key: "2", label: "选填站点" }
                        ],
                        summary: "请勿侵犯著作权"
                    },
                    {
                        title: "不实信息",
                        template: "Template:UserMessages/FalseInformation",
                        parameters: [
                            { key: "1", label: "页面名" }
                        ],
                        summary: "请勿添加不实信息"
                    },
                    {
                        title: "Wiki语法",
                        template: "Template:UserMessages/WikiMarkupLanguage",
                        parameters: [],
                        summary: "关于Wiki语法"
                    },
                    {
                        title: "剪贴移动",
                        template: "Template:UserMessages/CutAndPasteMoving",
                        parameters: [
                            { key: "1", label: "页面名" }
                        ],
                        summary: "请勿剪切移动页面"
                    },
                    {
                        title: "编辑用户页",
                        template: "Template:UserMessages/EditUserPage",
                        parameters: [
                            { key: "1", label: "页面名" }
                        ],
                        summary: "请勿编辑他人用户页面"
                    },
                    {
                        title: "幽默模板",
                        template: "Template:UserMessages/HumorTemplate",
                        parameters: [
                            { key: "1", label: "选填页面名" },
                            { key: "2", label: "选填行为" }
                        ],
                        summary: "关于幽默模板的使用"
                    },
                    {
                        title: "违规字词转换",
                        template: "Template:UserMessages/ConversionViolation",
                        parameters: [
                            { key: "1", label: "选填页面名" },
                            { key: "2", label: "选填行为" }
                        ],
                        summary: "关于您近期的编辑"
                    },
                    {
                        title: "文件授权协议",
                        template: "Template:UserMessages/FileLicense",
                        parameters: [
                            { key: "1", label: "文件名" }
                        ],
                        summary: "关于您近期上传的文件"
                    },
                    {
                        title: "截图文件授权",
                        template: "Template:UserMessages/FileLicense2",
                        parameters: [
                            { key: "1", label: "文件名" }
                        ],
                        summary: "关于您近期上传的截图文件"
                    },
                    {
                        title: "用户文件",
                        template: "Template:UserMessages/UserFile",
                        parameters: [],
                        summary: "关于您上传的文件"
                    },
                    {
                        title: "修改历史发言",
                        template: "Template:UserMessages/DiscussionViolation",
                        parameters: [
                            { key: "1", label: "选填页面名或差异" }
                        ],
                        summary: "关于您在讨论区的发言"
                    },
                    {
                        title: "违反讨论区方针",
                        template: "Template:UserMessages/DiscussionViolation2",
                        parameters: [
                            { key: "1", label: "页面名或差异" },
                            { key: "2", label: "原因" }
                        ],
                        summary: "关于您在讨论区的发言"
                    },
                    {
                        title: "删除历史发言",
                        template: "Template:UserMessages/DiscussionViolation3",
                        parameters: [
                            { key: "1", label: "选填页面名或差异" }
                        ],
                        summary: "关于您在讨论区的行为"
                    },
                    {
                        title: "人身攻击提醒",
                        template: "Template:UserMessages/PersonalAttacks",
                        parameters: [
                            { key: "1", label: "页面名" },
                            { key: "2", label: "选填用户" }
                        ],
                        summary: "请勿人身攻击"
                    },
                    {
                        title: "人身攻击警告",
                        template: "Template:UserMessages/PersonalAttacks2",
                        parameters: [],
                        summary: "人身攻击警告"
                    },
                    {
                        title: "未签名",
                        template: "Template:UserMessages/Signature",
                        parameters: [
                            { key: "1", label: "页面名" }
                        ],
                        summary: "关于您的签名"
                    },
                    {
                        title: "签名违规",
                        template: "Template:UserMessages/Signature2",
                        parameters: [
                            { key: "1", label: "页面名" }
                        ],
                        summary: "关于您的签名"
                    },
                    {
                        title: "编辑战通知",
                        template: "Template:UserMessages/EditWar",
                        parameters: [
                            { key: "1", label: "页面名" }
                        ],
                        summary: "提醒您参与讨论"
                    },
                    {
                        title: "编辑战提醒",
                        template: "Template:UserMessages/EditWar2",
                        parameters: [
                            { key: "1", label: "页面名" }
                        ],
                        summary: "编辑战提醒"
                    },
                    {
                        title: "编辑战警告",
                        template: "Template:UserMessages/EditWar3",
                        parameters: [
                            { key: "1", label: "页面名" },
                            { key: "2", label: "选填原因" }
                        ],
                        summary: "编辑战警告"
                    },
                    {
                        title: "最终警告",
                        template: "Template:UserMessages/FinalWarning",
                        parameters: [
                            { key: "1", label: "选填原因" },
                            { key: "2", label: "选填原因" }
                        ],
                        summary: "警告：忍耐是有限的"
                    },
                    {
                        title: "大家族模板排序",
                        template: "Template:UserMessages/NavSort",
                        parameters: [
                            { key: "1", label: "页面名" }
                        ],
                        summary: "关于大家族模板的排序"
                    },
                    {
                        title: "回复无缩进",
                        template: "Template:UserMessages/ReplyNoIndentation",
                        parameters: [
                            { key: "1", label: "页面名" },
                            { key: "2", label: "被回复人" }
                        ],
                        summary: "关于您在讨论区的发言"
                    },
                    {
                        title: "超速编辑",
                        template: "Template:UserMessages/OverSpeedEdit",
                        parameters: [],
                        summary: "关于您近期的编辑"
                    }
                ],
				primaryAction: { label: "预览", actionType: "progressive" }
			};
		},
		computed: {
			menuItems() {
				return this.templates.map((item, index) => ({
					label: item.title,
					value: index
				}));
			},
			selectedTemplate() {
				return (this.selected !== null && this.templates[this.selected]) || null;
			},
			previewActions() {
				return {
					default: { label: "关闭" },
					primary: { 
						label: this.sending ? "发送中..." : "发送提醒", 
						actionType: "progressive",
						disabled: this.sending
					}
				};
			}
		},
		watch: {
			selected(newVal) {
				if (newVal !== null) {
					this.editSummary = this.templates[newVal].summary;
					this.parameterValues = {};
					this.customMode = false;
					this.customText = "";
				}
			},
			async customMode(newVal) {
				if (newVal && this.selectedTemplate) {
					await this.loadTemplateSource(this.selectedTemplate.template);
				}
			}
		},
		template: `
			<!-- 主对话框 -->
			<cdx-dialog
				v-model:open="showDialog"
				title="向用户发送提醒"
				:use-close-button="true"
				:primary-action="primaryAction"
				@primary="previewTemplate"
			>
				<div class="umdev-dialog-content">
					<cdx-field>
						<template #label>选择模板</template>
						<cdx-select
							v-model:selected="selected"
							:menu-items="menuItems"
							default-label="请选择模板"
						></cdx-select>
					</cdx-field>

					<cdx-field v-if="selectedTemplate">
						<cdx-checkbox v-model="customMode">
							自定义内容
						</cdx-checkbox>
					</cdx-field>

					<cdx-field
						v-for="(param, index) in (selectedTemplate?.parameters || [])"
						:key="index"
						v-if="selectedTemplate && !customMode"
					>
						<template #label>{{ param.label }}</template>
						<cdx-text-input v-model="parameterValues[param.key]"></cdx-text-input>
					</cdx-field>

					<cdx-field>
						<template #label>编辑摘要</template>
						<cdx-text-input v-model="editSummary"></cdx-text-input>
					</cdx-field>

					<cdx-field v-if="customMode">
						<template #label>自定义内容</template>
						<cdx-text-area
							v-model="customText"
							:autosize="true"
							rows="6"
							class="umdev-textarea"
						></cdx-text-area>
						<div v-if="loadingSource">正在加载模板源代码...</div>
					</cdx-field>
				</div>
			</cdx-dialog>

			<cdx-dialog
				v-if="showPreview"
				v-model:open="showPreview"
				title="预览"
				:use-close-button="true"
				:default-action="previewActions.default"
				:primary-action="previewActions.primary"
				@default="showPreview = false"
				@primary="sendToTalkPage"
			>
				<div class="umdev-dialog-content" v-html="previewHtml"></div>
			</cdx-dialog>
		`,
		methods: {
            openDialog() {
                this.showDialog = true;
            },
            async loadTemplateSource(title) {
                this.loadingSource = true;
                try {
                    const data = await api.get({
                        action: "query",
                        prop: "revisions",
                        rvprop: "content",
                        titles: title,
                        formatversion: 2
                    });
                    const page = data.query.pages[0];
                    let content = page.revisions?.[0]?.content || "";

                    content = content
                        .replace(/<noinclude>[\s\S]*?<\/noinclude>/gi, "")
                        .replace(/<includeonly>[\s\S]*?<\/includeonly>/gi, "")
                        .replace(/<onlyinclude>|<\/onlyinclude>/gi, "");

                    this.customText = content.trim();
                } catch (err) {
                    this.customText = `加载模板源代码失败：${err}`;
                } finally {
                    this.loadingSource = false;
                }
            },
            async previewTemplate() {
                let wikitext = "";

                if (this.customMode) {
                    wikitext = this.customText;
                } else {
                    const tpl = this.selectedTemplate;
                    if (!tpl) return;

                    wikitext = `{{${tpl.template}`;
                    if (tpl.parameters?.length) {
                        tpl.parameters.forEach(param => {
                            const val = this.parameterValues[param.key];
                            if (val) wikitext += `|${param.key}=${val}`;
                        });
                    }
                    wikitext += "}}";
                }

                this.previewWikitext = wikitext;

                try {
                    const res = await api.post({
                        action: "parse",
                        text: wikitext,
                        contentmodel: "wikitext",
                        format: "json"
                    });
                    this.previewHtml = res.parse.text["*"];
                    this.showPreview = true;
                } catch (err) {
                    this.previewHtml = `<div style="color:red;">预览出错：${err}</div>`;
                    this.showPreview = true;
                }
            },
            async sendToTalkPage() {
                const targetUser = mw.config.get("wgRelevantUserName");
                if (!targetUser) {
                    mw.notify("无法获取目标用户名", { type: "error" });
                    return;
                }

                this.sending = true;
                try {
                    let wikitextToSend = this.previewWikitext;

                    if (!this.customMode && this.selectedTemplate) {
                        wikitextToSend = this.previewWikitext.replace(/^{{/, "{{subst:");
                    }

                    await api.postWithToken("csrf", {
                        action: "edit",
                        assertuser: mw.config.get("wgUserName"),
                        format: "json",
                        title: `User talk:${targetUser}`,
                        section: "new",
                        sectiontitle: "",
                        text: `${wikitextToSend} ——~~~~`,
                        summary: this.editSummary,
                        tags: "Automation tool|UserMessages"
                    });

                    mw.notify("已成功发送到讨论页", { type: "success" });
                    this.showPreview = false;
                    this.showDialog = false;
                } catch (err) {
                    mw.notify(`发送失败：${err}`, { type: "error" });
                } finally {
                    this.sending = false;
                }
            }
        },

		mounted() {
			dialogTrigger.addEventListener("click", this.openDialog);
		},
		unmounted() {
			dialogTrigger.removeEventListener("click", this.openDialog);
		}
	})
	.component("cdx-dialog", Codex.CdxDialog)
	.component("cdx-field", Codex.CdxField)
	.component("cdx-text-input", Codex.CdxTextInput)
	.component("cdx-text-area", Codex.CdxTextArea)
	.component("cdx-select", Codex.CdxSelect)
	.component("cdx-button", Codex.CdxButton)
	.component("cdx-checkbox", Codex.CdxCheckbox)
	.mount(mountPoint);
});