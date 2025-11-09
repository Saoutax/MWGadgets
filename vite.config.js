import { defineConfig } from "vite";
import { resolve } from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, "..");

function getEntries() {
    const srcDir = resolve(__dirname, "src");
    const entries = {};
    fs.readdirSync(srcDir).forEach((dir) => {
        const jsPath = resolve(srcDir, dir, "index.js");
        const tsPath = resolve(srcDir, dir, "index.ts");
        const cssPath = resolve(srcDir, dir, "index.css");

        if (fs.existsSync(tsPath)) {
        entries[dir] = tsPath;
        } else if (fs.existsSync(jsPath)) {
        entries[dir] = jsPath;
        } else if (fs.existsSync(cssPath)) {
        entries[dir] = cssPath;
        }
    });
    return entries;
}

export default defineConfig({
    mode: "production",
    build: {
        sourcemap: true,
        outDir: "dist",
        emptyOutDir: true,
        target: "esnext",
        minify: "esbuild",
        cssCodeSplit: true,
        rollupOptions: {
        input: getEntries(),
        output: {
            entryFileNames: "[name].min.js",
            assetFileNames: (assetInfo) => {
            if (assetInfo.name && assetInfo.name.endsWith(".css")) {
                return "[name].min.[ext]";
            }
            return "[name].[ext]";
            },
        },
        },
    },
    resolve: {
        extensions: [".ts", ".js", ".css"],
    },
});
