export default [
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
];