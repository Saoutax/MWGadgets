// webpack.config.js
const path = require("path");
const fs = require("fs");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

function getEntries() {
  const srcDir = path.resolve(__dirname, "src");
  const entries = {};
  fs.readdirSync(srcDir).forEach((dir) => {
    const fullPath = path.join(srcDir, dir, "index.js");
    if (fs.existsSync(fullPath)) {
      entries[dir] = fullPath;
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
        test: /\.css$/i,
        use: [MiniCssExtractPlugin.loader, "css-loader"],
      },
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: "babel-loader",
        },
      },
    ],
  },
  plugins: [
    new MiniCssExtractPlugin({
      filename: "[name].min.css",
    }),
  ],
  resolve: {
    extensions: [".js", ".css"],
  },
};
