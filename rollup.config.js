
/* eslint-disable no-undef */
const path = require('path');
const meta = require('./package.json');

import resolve from "@rollup/plugin-node-resolve";
import replace from "rollup-plugin-replace";
import serve from "rollup-plugin-serve";
import livereload from "rollup-plugin-livereload";
import visualizer from "rollup-plugin-visualizer";

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
const plugins = (outputName) => [
    resolve(),
    replace({
        __VERSION: JSON.stringify(meta.version),
        __BUILD: +(new Date()),
        __PACKAGE_JSON_FIELDS: JSON.stringify({
          homepage: meta.homepage,
          name: meta.name,
          description: meta.description
        })
      }),
    __DEVSERVER__ && serve({
        contentBase: ["dist"],
        port: 9000,
        verbose: true
    }),
    __DEVSERVER__ && livereload("dist/"),
    !__DEVSERVER__ && visualizer({
        filename: `./dist/stats-${outputName}.html`
    }),
];

module.exports = dir => [{
    input: {"Vizabi": path.resolve(__dirname, 'src', 'core', 'vizabi_entry.js')},
    output: output("Vizabi", dir), 
    external,
    plugins: plugins("Vizabi")
}, {
    input: {"Dataframe": path.resolve(__dirname, 'src', 'dataframe', 'dataFrame.js')},
    output: output("Dataframe", dir),
    external,
    plugins: plugins("Dataframe")
}]
