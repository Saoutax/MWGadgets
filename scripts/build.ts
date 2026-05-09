import fs from 'fs';
import path from 'path';
import { build, InlineConfig } from 'vite';
import { libInjectCss } from 'vite-plugin-lib-inject-css';

const ROOT = process.cwd();
const SRC_DIR = path.resolve(ROOT, 'src');
const GADGETS_ROOT = path.resolve(ROOT, 'src/gadgets');
const DIST_DIR = path.resolve(ROOT, 'dist');
const ENTRY_REGEXP = /\.(ts|tsx|js|jsx|css|scss|less)$/i;

function cleanDist(dir: string) {
    if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
    }
    fs.mkdirSync(dir, { recursive: true });
}

function findEntry(dir: string, name: string): string | null {
    const files = fs.readdirSync(dir);
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
    cleanDist(DIST_DIR);

    const gadgetDirs = fs.readdirSync(GADGETS_ROOT).filter(dir => fs.statSync(path.join(GADGETS_ROOT, dir)).isDirectory());

    for (const name of gadgetDirs) {
        const dir = path.join(GADGETS_ROOT, name);
        const entryFile = findEntry(dir, name);

        if (!entryFile) {
            console.warn(`⚠️ Skipped ${name}: Failed to find entry file`);
            continue;
        }

        await buildGadget(name, path.join(dir, entryFile));
    }
})();
