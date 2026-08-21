/// <reference types="oojs-ui" />

/*
 * 显式引用 @types/oojs-ui：TypeScript 6 不再自动包含 node_modules/@types 下的包，
 * 需要在此显式引用，才能让全局的 OO / OO.ui 命名空间生效。
 */

declare namespace mw.widgets {
    /**
     * 带自动补全建议的页面标题输入框（mediawiki.widgets.TitleInputWidget）。
     */
    class TitleInputWidget extends OO.ui.TextInputWidget {
        /**
         * @param options 配置项，suggestions 开启标题联想，required 必填
         */
        constructor(options: OO.ui.TextInputWidget.ConfigOptions & { suggestions?: boolean; required?: boolean });
    }

    namespace datetime {
        /**
         * 日期时间输入框（mediawiki.widgets.datetime.DateTimeInputWidget）。
         */
        class DateTimeInputWidget extends OO.ui.InputWidget {}
    }
}

declare namespace OO.ui {
    /**
     * 补充 @types/oojs-ui 未声明的 ProcessDialog 实例属性
     * （这些属性在 OOUI 运行时真实存在，参考代码大量使用）。
     */
    interface ProcessDialog {
        /** 对话框内容区域的 jQuery 节点 */
        $body: JQuery;
        /** 对话框底部操作区的 jQuery 节点 */
        $foot: JQuery;
        /** 对话框动作集合，可按模式切换 */
        actions: ActionSet;
    }
}
