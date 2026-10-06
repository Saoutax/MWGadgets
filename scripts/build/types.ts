/**
 * 构建脚本内部流通的数据结构。
 */

/** 入口类型：脚本入口产出 IIFE（CSS 内联进 JS），样式入口只产出 CSS。 */
export type GadgetKind = 'script' | 'style';

/** 一个待构建的小工具。 */
export interface Gadget {
    name: string;
    /** 入口文件绝对路径 */
    entry: string;
    kind: GadgetKind;
}

/** 扫描 src/gadgets/ 的结果：解析成功的小工具，以及全部入口问题。 */
export interface ResolvedGadgets {
    gadgets: Gadget[];
    problems: string[];
}

/** 写进产物目录的一个文件。 */
export interface Artifact {
    name: string;
    bytes: number;
}

/** 构建过程中被截获的一条 Vite 日志。 */
export interface CapturedLog {
    level: 'info' | 'warn' | 'error';
    message: string;
}

/** 单个小工具的构建结果；失败时不抛出，而是把错误收在这里。 */
export interface BuildResult {
    gadget: Gadget;
    ok: boolean;
    /** 构建失败的原因；成功时不存在 */
    error?: unknown;
    /** 本次写出的产物；失败时为空数组 */
    artifacts: Artifact[];
    durationMs: number;
    /** 本次构建期间截获的 Vite 日志，成功的丢弃 info、失败的整段展开 */
    log: CapturedLog[];
}
