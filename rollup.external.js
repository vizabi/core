/* eslint-disable no-undef */
const path = require('path');
const meta = require("./package.json");
const resolve = require("rollup-plugin-node-resolve");

const copyright = `// ${meta.homepage} v${meta.version} Copyright ${(new Date).getFullYear()} ${meta.author.name}`;

const output = (name, output) => ({
    name: name,
    dir: output || "dist",        
    entryFileNames: '[name].js',
    format: "umd",
    banner: copyright,
    sourcemap: true
});
const external = ["mobx"];
const plugins = () => [
    resolve()
];

module.exports = dir => [{
    input: {"Vizabi": path.resolve(__dirname, 'src', 'core', 'vizabi.js')},
    output: output("Vizabi", dir), 
    external,
    plugins: plugins()
}, {
    input: {"Dataframe": path.resolve(__dirname, 'src', 'dataframe', 'dataFrame.js')},
    output: output("Dataframe", dir),
    external,
    plugins: plugins()
}]
