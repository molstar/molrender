const path = require('path');
const webpack = require('webpack');

module.exports = [
    {
        target: 'node',
        node: {
            __dirname: false,
            __filename: false,
        },
        externals: {
            argparse: 'require("argparse")',
            gl: 'require("gl")',
            pngjs: 'require("pngjs")',
            sharp: 'require("sharp")'
        },
        plugins: [
            new webpack.DefinePlugin({
                __PLUGIN_VERSION_TIMESTAMP__: webpack.DefinePlugin.runtimeValue(() => `${new Date().valueOf()}`, true),
                'process.env.DEBUG': JSON.stringify(process.env.DEBUG)
            }),
            new webpack.BannerPlugin({ banner: "#!/usr/bin/env node", raw: true, entryOnly: true }),
        ],
        resolve: {
            modules: [
                'node_modules',
                path.resolve(__dirname, 'build/src/')
            ],
        },
        entry: path.resolve(__dirname, `build/src/index.js`),
        output: { filename: `molrender.js`, path: path.resolve(__dirname, `build/bin`) },
        mode: 'development',
        devtool: 'source-map'
    }
];