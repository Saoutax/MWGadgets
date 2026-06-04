import { execSync } from 'node:child_process';
import { readdir, mkdir, rm, stat, writeFile } from 'node:fs/promises';
import { resolve, dirname, join, extname } from 'node:path';
import { build as esbuild, type Plugin } from 'esbuild';
import { compile as sassCompile } from 'sass-embedded';

const ROOT = process.cwd();
const SRC_DIR = resolve(ROOT, 'src');
const GADGETS_ROOT = resolve(ROOT, 'src/gadgets');
const DIST_DIR = resolve(ROOT, 'dist');
const ENTRY_REGEXP = /\.(ts|tsx|js|jsx|css|scss)$/i;
const UNSAFE_JS_CHARS = /[<>\u2028\u2029/\\\b\f\n\r\t\0]/g;
const UNSAFE_JS_CHAR_MAP: Record<string, string> = {
    '<': '\\u003C',
    '>': '\\u003E',
    '/': '\\u002F',
    '\\': '\\\\',
    '\b': '\\b',
    '\f': '\\f',
    '\n': '\\n',
    '\r': '\\r',
    '\t': '\\t',
    '\0': '\\0',
    '\u2028': '\\u2028',
    '\u2029': '\\u2029',
};

const escapeUnsafeForJsCode = (value: string): string =>
    value.replace(UNSAFE_JS_CHARS, ch => UNSAFE_JS_CHAR_MAP[ch] ?? ch);

const isStyleEntry = (file: string): boolean => /\.(css|scss)$/i.test(file);

const cssInJsPlugin: Plugin = {
    name: 'css-in-js',
    setup(build_) {
        build_.onResolve({ filter: /\.scss$/ }, args => ({
            path: resolve(dirname(args.importer), args.path),
            namespace: 'scss-in-js',
        }));
        build_.onLoad({ filter: /.*/, namespace: 'scss-in-js' }, args => {
            const result = sassCompile(args.path, { style: 'compressed' });
            return {
                contents: `(()=>{const e=document.createElement("style");e.textContent=${escapeUnsafeForJsCode(JSON.stringify(result.css))};document.head.appendChild(e)})();`,
                loader: 'js',
            };
        });
        build_.onResolve({ filter: /\.css$/ }, args => ({
            path: resolve(dirname(args.importer), args.path),
            namespace: 'css-in-js',
        }));
        build_.onLoad({ filter: /.*/, namespace: 'css-in-js' }, async args => {
            const result = await esbuild({
                entryPoints: [args.path],
                minify: true,
                write: false,
                logLevel: 'silent',
            });
            const css = result.outputFiles[0]!.text.trim();
            return {
                contents: `(()=>{const e=document.createElement("style");e.textContent=${escapeUnsafeForJsCode(JSON.stringify(css))};document.head.appendChild(e)})();`,
                loader: 'js',
            };
        });
    },
};

const cleanDist = async () => {
    await rm(DIST_DIR, { recursive: true, force: true });
    await mkdir(DIST_DIR, { recursive: true });
};

const findEntry = async (dir: string, name: string) => {
    const files = await readdir(dir);
    return files.find(f => ENTRY_REGEXP.test(f) && f.startsWith(name + '.')) ?? null;
};

const buildJSGadget = async (name: string, entry: string) => {
    console.log(`📦 Building Gadget: ${name}`);
    await esbuild({
        entryPoints: [entry],
        bundle: true,
        format: 'iife',
        minify: true,
        sourcemap: true,
        charset: 'utf8',
        target: 'esnext',
        jsx: 'automatic',
        jsxImportSource: 'preact',
        alias: { '@': SRC_DIR },
        plugins: [cssInJsPlugin],
        outfile: join(DIST_DIR, `${name}.min.js`),
        logLevel: 'warning',
    });
};

const buildStyleGadget = async (name: string, entry: string) => {
    console.log(`📦 Building Gadget Style: ${name}`);
    const ext = extname(entry).toLowerCase();
    let css: string;

    if (ext === '.scss') {
        css = sassCompile(entry, { style: 'compressed' }).css;
    } else {
        const result = await esbuild({
            entryPoints: [entry],
            minify: true,
            write: false,
            logLevel: 'silent',
        });
        css = result.outputFiles[0]!.text.trim();
    }

    await writeFile(join(DIST_DIR, `${name}.min.css`), css);
};

(async () => {
    console.log('🧹 Cleaning dist directory...');
    await cleanDist();

    console.log('🔍 Running type check...');
    execSync('npx tsc --noEmit', { stdio: 'inherit' });

    const gadgetDirs = (
        await Promise.all(
            (
                await readdir(GADGETS_ROOT)
            ).map(async dir => {
                const fullPath = join(GADGETS_ROOT, dir);
                return (await stat(fullPath)).isDirectory() ? dir : null;
            }),
        )
    ).filter(Boolean) as string[];

    for (const name of gadgetDirs) {
        const dir = join(GADGETS_ROOT, name);
        const entryFile = await findEntry(dir, name);

        if (!entryFile) {
            console.warn(`⚠️ Skipped ${name}: Failed to find entry file`);
            continue;
        }

        const fullPath = join(dir, entryFile);

        if (isStyleEntry(entryFile)) {
            await buildStyleGadget(name, fullPath);
        } else {
            await buildJSGadget(name, fullPath);
        }
    }

    console.log('✅ Build complete');
})();
