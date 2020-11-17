const path = require('path');
const process = require('process');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

module.exports = {
    entry: path.resolve(__dirname, 'src', 'index.js'),
    output: {
        path: path.resolve(__dirname, 'public'),
    },
    devServer: {
        contentBase: path.resolve(__dirname, 'public'),
        open: true,
    },
    module: {
        rules: [
            {
                test: /\.js$/i,
                exclude: /node_modules/,
                use: 'babel-loader',
            },
            {
                test: /\.css$/i,
                use: [MiniCssExtractPlugin.loader, 'css-loader'],
            },
        ],
    },
    plugins: [
        new CleanWebpackPlugin(),
        new HtmlWebpackPlugin({
            template: path.resolve(__dirname, 'src', 'index.html'),
        }),
        new MiniCssExtractPlugin(),
    ],
};

if (process.env.NODE_ENV !== 'production') {
    module.exports.devtool = 'inline-source-map';
}
