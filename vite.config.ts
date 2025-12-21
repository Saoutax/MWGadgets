import fs from "fs";
import { resolve } from "path";
import { defineConfig } from "vite";

const ROOT = resolve(__dirname, "src/gadgets");
const EXT = "(tsx|ts|jsx|js|scss|less|css)";

const entries = Object.fromEntries(
    fs
        .readdirSync(ROOT)
        .map(name => {
            const entry = fs.readdirSync(resolve(ROOT, name)).find(f => new RegExp(`^${name}\\.${EXT}$`).test(f));
            return entry ? [name, resolve(ROOT, name, entry)] : null;
        })
        .filter(Boolean) as [string, string][],
);

export default defineConfig({
    build: {
        outDir: "dist",
        emptyOutDir: true,
        sourcemap: true,
        cssCodeSplit: true,
        minify: "terser",
        rollupOptions: {
            input: entries,
            output: {
                entryFileNames: "[name].min.js",
                assetFileNames: ({ name }) => (name?.endsWith(".css") ? "[name].min.css" : "[name][extname]"),
            },
        },
    },
});
