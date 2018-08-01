import { action, toJS } from 'mobx';
import { deepmerge, assign, defaultDecorator } from "../utils";
import { configurable } from '../configurable';
import { dataSourceStore } from '../dataSource/dataSourceStore';
import { markerStore } from '../marker/markerStore';
import { scaleLinear, scaleSqrt, scaleLog, scalePoint, scaleOrdinal, schemeCategory10, extent, set } from 'd3'

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
    space: null,
    filter: null
}

const functions = {
    get which() { return this.config.which; },
    get filter() { return this.config.filter },
    get marker() {
        return markerStore.getMarkerForEncoding(this) || console.warn("Couldn't find marker model for encoding.", { encoding: this });
    },
    get space() {
        return this.config.space || this.marker.space;
    },
    get dataSource() {
        return dataSourceStore.getByDefinition(this.config.dataSource)
    },
    get ddfQuery() {
        const query = {
            select: {
                key: this.space.toJS(),
                value: [this.which]
            }
        }
        if (this.filter) {
            query.where = toJS(this.filter);
        }
        return query;
    },
    get load() {
        return this.dataSource.query(this.ddfQuery);
    },
    get data() {
        if (this.space.includes(this.which)) return [];
        else return this.load.get();
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

export function baseEncoding(config) {
    config = deepmerge.all([{}, defaultConfig, config]);
    return assign({}, functions, configurable, { config });
}