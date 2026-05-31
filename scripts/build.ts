import { execSync } from 'node:child_process';
import { readdir, mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { build, type InlineConfig } from 'vite';
import { libInjectCss } from 'vite-plugin-lib-inject-css';

const ROOT = process.cwd();
const SRC_DIR = path.resolve(ROOT, 'src');
const GADGETS_ROOT = path.resolve(ROOT, 'src/gadgets');
const DIST_DIR = path.resolve(ROOT, 'dist');
const ENTRY_REGEXP = /\.(ts|tsx|js|jsx|css|scss|less)$/i;

async function cleanDist(dir: string) {
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
}

async function findEntry(dir: string, name: string): Promise<string | null> {
    const files = await readdir(dir);
    return files.find(f => ENTRY_REGEXP.test(f) && f.startsWith(name + '.')) ?? null;
}

async function buildGadget(name: string, entry: string) {
    const isStyleEntry = /\.(css|scss|less)$/i.test(entry);

    const config: InlineConfig = {
        configFile: false,
        plugins: [libInjectCss()],
        resolve: {
            alias: {
                '@': SRC_DIR,
            },
        },
        build: {
            emptyOutDir: false,
            sourcemap: true,
            outDir: DIST_DIR,
            minify: 'esbuild',
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
                    inlineDynamicImports: true,
                    extend: false,
                    assetFileNames: assetInfo => {
                        if (assetInfo.name?.endsWith('.css')) {
                            return `${name}.min.css`;
                        }
                        return '[name][extname]';
                    },
                },
            },
        },
    };

    console.log(`📦 Building Gadget: ${name}`);
    await build(config);
}

(async () => {
    console.log('🧹 Cleaning dist directory...');
    await cleanDist(DIST_DIR);

    console.log('🔍 Running type check...');
    execSync('npx tsc --noEmit', { stdio: 'inherit' });

    const gadgetDirs = (
        await Promise.all(
            (
                await readdir(GADGETS_ROOT)
            ).map(async dir => {
                const fullPath = path.join(GADGETS_ROOT, dir);
                return (await stat(fullPath)).isDirectory() ? dir : null;
            }),
        )
    ).filter(Boolean) as string[];

    for (const name of gadgetDirs) {
        const dir = path.join(GADGETS_ROOT, name);
        const entryFile = await findEntry(dir, name);

        if (!entryFile) {
            console.warn(`⚠️ Skipped ${name}: Failed to find entry file`);
            continue;
        }

        await buildGadget(name, path.join(dir, entryFile));
    }
})();
