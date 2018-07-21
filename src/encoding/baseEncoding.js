import { action } from 'mobx';
import { deepmerge, assign, defaultDecorator } from "../utils";
import { configurable } from '../configurable';
import { dataSourceStore } from '../dataSource/dataSourceStore';
import { scaleLinear, scaleSqrt, scaleLog, scalePoint, scaleOrdinal, schemeCategory10, extent, set } from 'd3'
let counter = 0;
const scales = {
    "linear": scaleLinear,
    "log": scaleLog,
    "sqrt": scaleSqrt,
    "ordinal": scaleOrdinal,
    "point": scalePoint
}

const defaultConfig = {
    which: "var",
    scale: null,
    dataSource: "data",
    domain: null,
    range: null,
}
let count = 1;
const functions = {
    get which() { return this.config.which; },
    get dataSource() {
        return dataSourceStore.getByDefinition(this.config.dataSource)
    },
    get data() {
        return this.dataSource.data;
    },
    get range() {
        if (this.config.range != null)
            return this.config.range

        // default
        return (this.config.scale == "ordinal") ?
            schemeCategory10 : [0, 1];
    },
    get scale() {
        return scales[this.config.scale] ? this.config.scale : "linear";
    },
    get d3Scale() {
        const scale = scales[this.scale]();
        const domain = (this.scale == "log" && this.domain[0] == 0) ? [1, this.domain[1]] : this.domain;
        return scale.range(this.range).domain(domain);
    },
    get domain() {
        if (this.config.domain != null)
            return this.config.domain

        // default to unique values or extent, depending on scale
        console.log(count++, "domain", this.which);
        const which = this.which;
        return (["ordinal", "point"].includes(this.scale)) ?
            set(this.data, d => d[which]).values().sort() :
            this.extent
    },
    get extent() {
        const which = this.which;
        return extent(this.data, d => d[which]);
    },
    setWhich: action('setWhich', function(which) {
        this.config.which = which;
        this.config.domain = null;
        this.config.scale = null;
    })
}
let oldData;
let oldWhich;
export function baseEncoding(config) {
    config = deepmerge.all([{}, defaultConfig, config]);
    return assign({}, functions, configurable, { config });
}