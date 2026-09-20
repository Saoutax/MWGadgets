/// <reference types="oojs-ui" />

/*
 * 显式引用 @types/oojs-ui：TypeScript 6 不再自动包含 node_modules/@types 下的包，
 * 需要在此显式引用，才能让全局的 OO / OO.ui 命名空间生效。
 *
 * 注意：OO / OO.ui 是 ResourceLoader 注入的全局变量，不参与打包。
 */

declare namespace mw.widgets {
    /**
     * 带标题联想的页面标题输入框（ResourceLoader 模块 mediawiki.widgets）。
     * $overlay 由 mediawiki.widgets 在运行时透传给内部菜单，但 @types/oojs-ui 未声明。
     */
    class TitleInputWidget extends OO.ui.TextInputWidget {
        /**
         * @param options 配置项，suggestions 开启标题联想，required 标记为必填
         */
        constructor(
            options: OO.ui.TextInputWidget.ConfigOptions & {
                suggestions?: boolean;
                required?: boolean;
                $overlay?: JQuery;
            },
        );
    }

    /**
     * 带用户名联想的输入框（ResourceLoader 模块 mediawiki.widgets.UserInputWidget）。
     * 内部按前缀查 action=query&list=allusers，$overlay 同样由 LookupElement 混入消费。
     */
    class UserInputWidget extends OO.ui.TextInputWidget {
        /**
         * @param options 配置项，limit 控制候选条数
         */
        constructor(
            options: OO.ui.TextInputWidget.ConfigOptions & {
                limit?: number;
                $overlay?: JQuery;
            },
        );
    }
}

declare namespace OO.ui {
    /**
     * 补充 @types/oojs-ui 未声明的 ProcessDialog 实例属性。
     * 这些属性在 OOUI 运行时真实存在（见 oojs-ui-windows.js），但类型定义里只出现在文档注释中：
     * $body 是对话框内容区，$foot 是底部操作区。
     * $overlay / $content / $frame 已由 Window.Props 声明，无需重复补充。
     */
    interface ProcessDialog {
        /** 对话框内容区域的 jQuery 节点 */
        $body: JQuery;
        /** 对话框底部操作区的 jQuery 节点 */
        $foot: JQuery;
    }
}
