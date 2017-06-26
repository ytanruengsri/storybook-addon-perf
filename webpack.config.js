const path = require('path');

const config = {
  entry: {
		index: "./src/index",
		register: "./src/register"
	},
  output: {
    path: path.resolve(__dirname, 'dist'),
    publicPath: "dist/",
    filename: '[name].js',
    library: 'storybook-addon-perf',
    libraryTarget: 'umd',
  },
  module: {
    rules: [
      {
        test: /\.(js|jsx)$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: 'babel-loader',
          options: {
            presets: ['env'],
          },
        },
      },
    ],
  },
  externals: {
    "react": "react",
    "prop-types": "prop-types",
    "react-addons-perf": "react-addons-perf",
  },
};

module.exports = config;
