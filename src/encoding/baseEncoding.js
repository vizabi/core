import { action, toJS, isObservableArray, trace, observable } from 'mobx';
import { deepmerge, assign, defaultDecorator, isString } from "../utils";
import { resolveRef } from '../vizabi';
import { configurable } from '../configurable';
import { dataSourceStore } from '../dataSource/dataSourceStore';
import { markerStore } from '../marker/markerStore';
//import { scaleLinear, scaleSqrt, scaleLog, scalePoint, scaleOrdinal, schemeCategory10, extent, set } from 'd3'

const scales = {
    "linear": d3.scaleLinear,
    "log": d3.scaleLog,
    "sqrt": d3.scaleSqrt,
    "ordinal": d3.scaleOrdinal,
    "point": d3.scalePoint
}

const defaultConfig = {
    data: {
        source: null,
        concept: "var",
        space: null,
        filter: null
    },
    scale: {
        type: null,
        domain: null,
        range: null
    }
}

const functions = {
    get marker() {
        //trace();
        const marker = markerStore.getMarkerForEncoding(this);
        if (marker == null) console.warn("Couldn't find marker model for encoding.", { encoding: this });
        return marker;
    },
    get data() {
        //trace();
        var cfg = this.config.data;
        if (isString(cfg.ref))
            return resolveRef(cfg);

        return this.createDataProp(cfg);
    },
    createDataProp(cfg) {
        return observable(Object.defineProperties({}, {
            source: { get: () => (cfg.source == null) ? null : dataSourceStore.getByDefinition(cfg.source), enumerable: true },
            space: {
                get: () => {
                    //trace();
                    return cfg.space || ((this.marker) ? this.marker.space : null)
                },
                enumerable: true
            },
            concept: { get: () => resolveRef(cfg.concept), enumerable: true },
            filter: { get: () => cfg.filter, enumerable: true },
            load: {
                get: function() {
                    //trace();
                    return this.source.query(this.ddfQuery)
                },
                enumerable: true
            },
            response: {
                get: function() {
                    //trace();
                    if (!this.hasOwnData) return [];
                    else return this.load.get();
                },
                enumerable: true
            },
            hasOwnData: {
                get: function() {
                    return this.space && !this.space.includes(this.concept) && this.source;
                },
                enumerable: true
            },
            ddfQuery: {
                get: function() {
                    const from = (this.space.length == 1) ? "entities" : "datapoints";
                    const query = {
                        select: {
                            key: this.space.slice(), // slice to make sure it's a normal array (not mobx)
                            value: [this.concept]
                        },
                        from
                    }
                    if (this.filter) {
                        query.where = toJS(this.filter);
                    }
                    return query;
                },
                enumerable: true
            }
        }))
    },
    get dataConnected() {
        this.space.includes(this.data);
    },
    get response() {
        //trace();
        return this.data.response
    },
    get space() {
        return this.data.space
    },
    get hasOwnData() {
        return this.data.hasOwnData
    },
    get scale() {
        if (isString(this.config.scale.ref))
            return resolveRef(this.config.scale);

        const scaleType = () => {
            return scales[this.config.scale.type] ? this.config.scale.type : "linear";
        }

        return Object.defineProperties({}, {
            type: { get: scaleType },
            domain: { get: this.domain.bind(this) },
            range: { get: this.range.bind(this) }
        });
    },
    range() {
        if (this.config.scale.range != null)
            return this.config.scale.range

        // default
        return (this.scale.type == "ordinal") ?
            d3.schemeCategory10 : [0, 1];
    },
    domain() {
        if (this.config.scale.domain != null)
            return this.config.scale.domain
        if (this.response == null)
            return [0, 1];

        // default to unique values or extent, depending on scale
        const which = this.data.concept;
        return (["ordinal", "point"].includes(this.scale.type)) ?
            d3.set(this.response, d => d[which]).values().sort() :
            d3.extent(this.response, d => d[which]);
    },
    processRow(row) {
        return row[this.data.concept];
    },
    get d3Scale() {
        const scale = scales[this.scale.type]();
        const domain = (this.scale.type == "log" && this.scale.domain[0] == 0) ? [1, this.scale.domain[1]] : this.scale.domain;
        return scale.range(this.scale.range).domain(domain);
    },
    setWhich: action('setWhich', function(which) {
        this.config.data.concept = which;
        this.config.scale.domain = null;
        this.config.scale.type = null;
    })
}


export function baseEncoding(config) {
    config = deepmerge.all([{}, defaultConfig, config]);
    return assign({}, functions, configurable, { config });
}