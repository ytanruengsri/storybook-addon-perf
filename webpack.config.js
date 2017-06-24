const path = require('path');

const config = {
  entry: './src/index.js',
  target: 'web',
  output: {
    path: path.resolve(__dirname, 'dist'),
    publicPath: "dist/",
    filename: 'index.js',
    library: 'storybook-addon-perf',
    libraryTarget: 'umd',
  },
  module: {
    rules: [
      { test: /\.js$/, use: 'babel-loader' },
    ],
  },
  externals: {
    "react": "react",
    "prop-types": "prop-types",
    "@storybook/addons": "@storybook/addons",
    "react-addons-perf": "react-addons-perf",
  },
};

module.exports = config;