/**
 * 单个小工具的 Vite 配置工厂。
 *
 * 本项目没有 vite.config.*，配置全部内联在这里。两种入口模式的差异集中在
 * createModeBuildOptions，其余部分共用。
 */

import type { InlineConfig, Logger } from 'vite';
import { libInjectCss } from 'vite-plugin-lib-inject-css';
import { SRC_DIR } from './constants';
import type { Gadget } from './types';

/**
 * 模块别名。
 *
 * ooui-react 以 react / react-dom 为 peer 依赖，本项目 JSX 用 Preact，经 preact/compat
 * （官方兼容方案）复用。顺序有讲究：preact 没有 ./compat/jsx-runtime 导出，
 * react/jsx-runtime 必须排在 react 前；react-dom/client 须先于 react-dom 命中，
 * 才能落到 preact/compat/client。
 */
const ALIASES = [
    { find: 'react/jsx-runtime', replacement: 'preact/jsx-runtime' },
    { find: 'react-dom/client', replacement: 'preact/compat/client' },
    { find: 'react-dom', replacement: 'preact/compat' },
    { find: 'react', replacement: 'preact/compat' },
    { find: '@', replacement: SRC_DIR },
];

/**
 * 取产物文件名。
 *
 * dist/ 是扁平目录，非 CSS 资源不加小工具名前缀的话，两个小工具的同名文件
 * （如 logo.svg）会互相覆盖。
 *
 * @param name 小工具名
 * @param original 资源原始文件名
 * @returns 写进产物目录的文件名
 */
const resolveAssetFileName = (name: string, original: string | null | undefined): string => {
    if (original?.endsWith('.css')) {
        return `${name}.min.css`;
    }
    return original ? `${name}.${original}` : `${name}.[extname]`;
};

/**
 * 两种入口共用的 build 选项。
 *
 * @param outDir 产物目录（构建期是暂存目录）
 * @returns Vite 的 build 选项片段
 */
const createBaseBuildOptions = (outDir: string): NonNullable<InlineConfig['build']> => ({
    outDir,
    // Vite 在 outDir 位于 root 内时默认清空它。这里必须关掉：暂存目录要连续装下
    // 本次全部小工具的产物，否则每构建一个就把此前写出的删掉。
    emptyOutDir: false,
    sourcemap: true,
    // 不指定 minify：Vite 8 的默认值已是 'oxc'（Rust 实现）。不要写回 'esbuild'
    // —— esbuild 并不在 Vite 8 的依赖里，现在能跑通只是因为 tsx 顺带安装了它。
    cssCodeSplit: false,
    // 产物目录是扁平的，不留 assets 子目录。
    assetsDir: '',
});

/**
 * 脚本入口独有的 build 选项：产出 IIFE。
 *
 * @param gadget 待构建的小工具
 * @returns Vite 的 build 选项片段
 */
const scriptBuildOptions = (gadget: Gadget): NonNullable<InlineConfig['build']> => ({
    lib: {
        entry: gadget.entry,
        name: gadget.name,
        formats: ['iife'],
        fileName: () => `${gadget.name}.min.js`,
    },
    rollupOptions: {
        output: {
            codeSplitting: false,
            extend: false,
            assetFileNames: assetInfo => resolveAssetFileName(gadget.name, assetInfo.name),
        },
    },
});

/**
 * 样式入口独有的 build 选项：把 .scss 直接当 input，只产出 CSS。
 *
 * 别给样式入口放 .css 文件：cssCodeSplit 为 false 时 Vite 拒绝 .css 作 input
 * （只检查 .css，.scss / .less / .styl 不受限）。真到需要支持那一步，得单独给样式入口
 * 开 cssCodeSplit，而那会多出一个空 JS chunk，与已提交的产物对不上。
 *
 * @param gadget 待构建的小工具
 * @returns Vite 的 build 选项片段
 */
const styleBuildOptions = (gadget: Gadget): NonNullable<InlineConfig['build']> => ({
    rollupOptions: {
        input: gadget.entry,
        output: {
            assetFileNames: assetInfo => resolveAssetFileName(gadget.name, assetInfo.name),
        },
    },
});

/**
 * 取某种入口模式独有的 build 选项。
 *
 * 两种模式的差异集中在这里：读一遍就知道脚本入口和样式入口各自是什么样子，
 * 不用去配置对象里逐个字段找条件分支。
 *
 * @param gadget 待构建的小工具
 * @returns 该模式独有的 build 选项
 */
const createModeBuildOptions = (gadget: Gadget): NonNullable<InlineConfig['build']> =>
    gadget.kind === 'script' ? scriptBuildOptions(gadget) : styleBuildOptions(gadget);

/**
 * 组装单个小工具的 Vite 配置。
 *
 * @param gadget 待构建的小工具
 * @param outDir 产物目录（构建期是暂存目录）
 * @param logger 接收 Vite 输出的 logger
 * @returns Vite 的内联配置
 */
export const createConfig = (gadget: Gadget, outDir: string, logger: Logger): InlineConfig => ({
    configFile: false,
    customLogger: logger,
    // 样式入口也得带上 libInjectCss，尽管它在那边只会报一句 "not in library mode or
    // building process, skip code injection" 然后跳过：拿掉之后纯样式入口会让
    // vite:css-post 的 generateBundle 崩在 "Cannot read properties of undefined
    // (reading 'referenceId')"。那句警告是绕开这个崩溃的代价，别顺手删。
    plugins: [libInjectCss()],
    resolve: { alias: ALIASES },
    build: { ...createBaseBuildOptions(outDir), ...createModeBuildOptions(gadget) },
});
