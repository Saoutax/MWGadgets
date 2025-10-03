// webpack.config.js
import path from "path";
import fs from "fs";
import MiniCssExtractPlugin from "mini-css-extract-plugin";
import TerserPlugin from "terser-webpack-plugin";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getEntries() {
  const srcDir = path.resolve(__dirname, "src");
  const entries = {};
  fs.readdirSync(srcDir).forEach((dir) => {
    const jsPath = path.join(srcDir, dir, "index.js");
    const tsPath = path.join(srcDir, dir, "index.ts");
    const cssPath = path.join(srcDir, dir, "index.css");
    const scssPath = path.join(srcDir, dir, "index.scss");
    const lessPath = path.join(srcDir, dir, "index.less");

    if (fs.existsSync(jsPath)) {
      entries[dir] = jsPath;
    } else if (fs.existsSync(tsPath)) {
      entries[dir] = tsPath;
    } else if (fs.existsSync(scssPath)) {
      entries[dir] = scssPath;
    } else if (fs.existsSync(lessPath)) {
      entries[dir] = lessPath;
    } else if (fs.existsSync(cssPath)) {
      entries[dir] = cssPath;
    }
  });
  return entries;
}

export default {
  mode: "production",
  entry: getEntries(),
  output: {
    path: path.resolve(__dirname, "dist"),
    filename: "[name].min.js",
    clean: true,
  },
  devtool: "source-map",
  module: {
    rules: [
      // JS & TS
      {
        test: /\.[jt]s$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env", "@babel/preset-typescript"],
          },
        },
      },
      // CSS
      {
        test: /\.css$/i,
        oneOf: [
          {
            issuer: /\.[jt]sx?$/,
            use: ["style-loader", "css-loader"],
          },
          {
            use: [MiniCssExtractPlugin.loader, "css-loader"],
          },
        ],
      },
      // Less
      {
        test: /\.less$/i,
        oneOf: [
          {
            issuer: /\.[jt]sx?$/,
            use: ["style-loader", "css-loader", "less-loader"],
          },
          {
            use: [MiniCssExtractPlugin.loader, "css-loader", "less-loader"],
          },
        ],
      },
      // SCSS
      {
        test: /\.s[ac]ss$/i,
        oneOf: [
          {
            issuer: /\.[jt]sx?$/,
            use: ["style-loader", "css-loader", "sass-loader"],
          },
          {
            use: [MiniCssExtractPlugin.loader, "css-loader", "sass-loader"],
          },
        ],
      },
    ],
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: "[name].min.css",
    }),
  ],
  optimization: {
    minimize: true,
    minimizer: [
      new TerserPlugin({
        extractComments: false,
        terserOptions: {
          format: {
            comments: false,
          },
        },
      }),
    ],
  },
  resolve: {
    extensions: [".js", ".ts", ".tsx", ".css", ".less", ".scss", ".sass"],
  },
};
