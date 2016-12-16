const { resolve } = require('path');
const webpack = require('webpack');

const config = {
    entry: [
        './index.js'
        // the entry point of our app
    ],
    output: {
        filename: 'bundle.js',
        // the output bundle

        path: resolve(__dirname, '../build'),

        publicPath: '/'
        // necessary for HMR to know where to load the hot update chunks
    },

    context: resolve(__dirname),

    devtool: 'inline-source-map',

    devServer: {
        hot: true,
        // activate hot reloading

        contentBase: resolve(__dirname, '../static'),
        // match the output path

        publicPath: '/'
        // match the output `publicPath`
    },

    module: {
        loaders: [
            { test: /\.js$/,
                loaders: [
                    'babel-loader',
                ],
                exclude: /node_modules/
            },
            {
                test: /\.css$/,
                loaders: [
                    'style-loader',
                    'css-loader?modules',
                    'postcss-loader',
                ],
            },
        ],
    },

    plugins: [
        new webpack.NamedModulesPlugin(),
        // prints more readable module names in the browser console on HMR updates
    ],
};

module.exports = config;