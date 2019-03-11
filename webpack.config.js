const path = require('path');

module.exports = {
    mode: 'development',
    entry: './src/core/vizabi.js',
    output: {
        filename: 'vizabi.js',
        path: path.resolve(__dirname, 'dist'),
        library: 'Vizabi',
        libraryExport: 'default'
    },

    devServer: {
        contentBase: path.join(__dirname, 'dist'),
        compress: false,
        port: 9000
    }
};