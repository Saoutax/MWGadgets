// webpack.config.js
const path = require("path");
const fs = require("fs");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const TerserPlugin = require("terser-webpack-plugin");

function getEntries() {
  const srcDir = path.resolve(__dirname, "src");
  const entries = {};
  fs.readdirSync(srcDir).forEach((dir) => {
    const jsPath = path.join(srcDir, dir, "index.js");
    const tsPath = path.join(srcDir, dir, "index.ts");
    const cssPath = path.join(srcDir, dir, "index.css");

    if (fs.existsSync(jsPath)) {
      entries[dir] = jsPath;
    } else if (fs.existsSync(tsPath)) {
      entries[dir] = tsPath;
    } else if (fs.existsSync(cssPath)) {
      entries[dir] = cssPath;
    }
  });
  return entries;
}

module.exports = {
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
    extensions: [".js", ".ts", ".tsx", ".css", ".less"],
  },
};
