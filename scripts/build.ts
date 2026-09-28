import { execSync } from 'node:child_process';
import { readdir, mkdir, rm, stat } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { build, type InlineConfig } from 'vite';
import { libInjectCss } from 'vite-plugin-lib-inject-css';

const ROOT = process.cwd();
const SRC_DIR = resolve(ROOT, 'src');
const GADGETS_ROOT = resolve(ROOT, 'src/gadgets');
const DIST_DIR = resolve(ROOT, 'dist');

/** 入口扩展名，按优先级排列；同名多种扩展名并存时取靠前的那个。 */
const ENTRY_EXTENSIONS = ['ts', 'tsx', 'js', 'jsx', 'scss', 'css'] as const;

const cleanDist = async (dir: string) => {
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
};

/**
 * 在 gadget 目录里查找入口文件。
 *
 * 不能依赖 readdir 的返回顺序（无保证）：一旦某目录同时存在 X.ts 与 X.scss，
 * 就会随文件系统顺序挑中不同文件，构建结果变得不确定。
 *
 * @param dir gadget 目录
 * @param name gadget 名，同时也是入口文件名（不含扩展名）
 * @returns 入口文件名
 */
const findEntry = async (dir: string, name: string): Promise<string> => {
    const files = new Set(await readdir(dir));
    const entry = ENTRY_EXTENSIONS.map(ext => `${name}.${ext}`).find(candidate => files.has(candidate));

    if (!entry) {
        throw new Error(`${name}: 未找到入口文件，期望 ${name}.{${ENTRY_EXTENSIONS.join('|')}}`);
    }
    return entry;
};

const buildGadget = async (name: string, entry: string) => {
    const isStyleEntry = /\.(css|scss)$/i.test(entry);

    const config: InlineConfig = {
        // 构建配置全部内联在这里，本项目没有 vite.config.*
        configFile: false,
        plugins: [libInjectCss()],
        resolve: {
            // ooui-react 以 react / react-dom 为 peer 依赖，本项目 JSX 用 Preact，
            // 经 preact/compat 别名复用（官方兼容方案）。顺序有讲究：
            // preact 没有 ./compat/jsx-runtime 导出，react/jsx-runtime 必须排在 react 前；
            // react-dom/client 须先于 react-dom 命中，才能落到 preact/compat/client。
            alias: [
                { find: 'react/jsx-runtime', replacement: 'preact/jsx-runtime' },
                { find: 'react-dom/client', replacement: 'preact/compat/client' },
                { find: 'react-dom', replacement: 'preact/compat' },
                { find: 'react', replacement: 'preact/compat' },
                { find: '@', replacement: SRC_DIR },
            ],
        },
        build: {
            // Vite 在 outDir 位于 root 内时默认清空它。这里必须关掉，
            // 否则每构建一个 gadget 都会把此前已写出的产物删掉。
            emptyOutDir: false,
            sourcemap: true,
            outDir: DIST_DIR,
            // 不指定 minify：Vite 8 的默认值已是 'oxc'（Rust 实现）。
            // 不要写回 'esbuild' —— esbuild 并不在 Vite 8 的依赖里，
            // 现在能跑通只是因为 tsx 顺带安装了它。
            cssCodeSplit: false,
            assetsDir: '',
            lib: isStyleEntry
                ? undefined
                : {
                      entry,
                      name,
                      formats: ['iife'],
                      fileName: () => `${name}.min.js`,
                  },
            rollupOptions: {
                input: isStyleEntry ? entry : undefined,
                output: {
                    codeSplitting: false,
                    extend: false,
                    assetFileNames: assetInfo => {
                        if (assetInfo.name?.endsWith('.css')) {
                            return `${name}.min.css`;
                        }
                        // dist 是扁平目录，非 CSS 资源不加 gadget 前缀时，
                        // 两个 gadget 的同名文件（如 logo.svg）会互相覆盖。
                        return assetInfo.name ? `${name}.${assetInfo.name}` : `${name}.[extname]`;
                    },
                },
            },
        },
    };

    console.log(`📦 Building Gadget: ${name}`);
    await build(config);
};

const main = async (): Promise<void> => {
    // 类型检查排在清空 dist 之前：类型错误是最常见的失败场景，
    // 若先清空再检查，一次编译错误就会让整个 dist 从工作区消失。
    // --noEmit 不能删：tsconfig.base.json 里有 declaration + composite，
    // 去掉会往 src/ 旁边输出 .js / .d.ts。
    console.log('🔍 Running type check...');
    execSync('npx tsc --build --noEmit', { stdio: 'inherit' });

    // 入口缺失同属配置错误，一并排在清空之前 —— 否则 dist 会停在只写入一部分的状态。
    const gadgetDirs = (
        await Promise.all(
            (await readdir(GADGETS_ROOT)).map(async dir => {
                const fullPath = join(GADGETS_ROOT, dir);
                return (await stat(fullPath)).isDirectory() ? dir : null;
            }),
        )
    ).filter(Boolean) as string[];

    const jobs = await Promise.all(
        gadgetDirs.map(async name => {
            const dir = join(GADGETS_ROOT, name);
            return { name, entry: join(dir, await findEntry(dir, name)) };
        }),
    );

    console.log('🧹 Cleaning dist directory...');
    await cleanDist(DIST_DIR);

    for (const { name, entry } of jobs) {
        await buildGadget(name, entry);
    }
};

try {
    await main();
} catch (error) {
    console.error('❌ 构建失败。dist/ 不会自动回滚，若已写入部分产物请勿提交；修复后重跑 `pnpm build`。');
    console.error(error);
    process.exitCode = 1;
}
