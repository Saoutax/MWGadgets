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
    const cssPath = path.join(srcDir, dir, "index.css");

    if (fs.existsSync(jsPath)) {
      entries[dir] = jsPath;
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
      // JS
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
          options: {
            presets: ["@babel/preset-env"],
          },
        },
      },
      // CSS
      {
        test: /\.css$/i,
        oneOf: [
          {
            issuer: /\.js$/,
            use: ["style-loader", "css-loader"],
          },
          {
            use: [MiniCssExtractPlugin.loader, "css-loader"],
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
    extensions: [".js", ".css"],
  },
};
