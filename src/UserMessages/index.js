import templates from './templates.js';
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
				templates,
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
						.replace(/<includeonly>/gi, "")
						.replace(/<\/includeonly>/gi, "");

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