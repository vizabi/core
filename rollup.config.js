
/* eslint-disable no-undef */
const path = require('path');

import * as meta from "./package.json";
import resolve from "@rollup/plugin-node-resolve";
import serve from "rollup-plugin-serve";
import livereload from "rollup-plugin-livereload";

const copyright = `// ${meta.homepage} v${meta.version} Copyright ${(new Date).getFullYear()} ${meta.author.name}`;
const __DEVSERVER__ = process.env.NODE_ENV === "devserver";

const output = (name, output) => ({
    name: name,
    dir: "dist",        
    entryFileNames: '[name].js',
    format: "umd",
    banner: copyright,
    sourcemap: true,
    globals: {
        "mobx": "mobx"
    }
});
const external = ["mobx"];
const plugins = () => [
    resolve(),
    __DEVSERVER__ && serve({
        contentBase: ["dist"],
        port: 9000,
        verbose: true
    }),
    __DEVSERVER__ && livereload("dist/"),
];

module.exports = dir => [{
    input: {"Vizabi": path.resolve(__dirname, 'src', 'core', 'vizabi_entry.js')},
    output: output("Vizabi", dir), 
    external,
    plugins: plugins()
}, {
    input: {"Dataframe": path.resolve(__dirname, 'src', 'dataframe', 'dataFrame.js')},
    output: output("Dataframe", dir),
    external,
    plugins: plugins()
}]
