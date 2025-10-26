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
    const cssPath = resolve(srcDir, dir, "index.css");

    if (fs.existsSync(jsPath)) {
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
    sourcemap: true,         // 生成 source map
    outDir: "dist",          // 输出目录
    emptyOutDir: true,       // 清空 dist
    target: "esnext",        // ✅ 保留箭头函数、现代语法
    minify: "esbuild",       // 默认压缩，速度极快
    cssCodeSplit: true,      // 每个入口单独输出 CSS
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
    extensions: [".js", ".css"],
  },
});
