const { resolve } = require('path');
const webpack = require('webpack');

const isProd = process.env.NODE_ENV == 'production';

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

    devtool: isProd ? 'cheap-source-map' : 'inline-source-map',

    devServer: isProd ? undefined : {
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
        new webpack.DefinePlugin({
            'process.env': {
                'NODE_ENV': JSON.stringify('production')
            }
        }),
        new webpack.NamedModulesPlugin(),
        new webpack.optimize.DedupePlugin(),
        new webpack.optimize.AggressiveMergingPlugin()
    ],
};

module.exports = config;