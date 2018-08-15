import { action, toJS, isObservableArray, trace, observable } from 'mobx';
import { deepmerge, assign, defaultDecorator, isString } from "../utils";
import { resolveRef } from '../vizabi';
import { configurable } from '../configurable';
import { dataSourceStore } from '../dataSource/dataSourceStore';
import { markerStore } from '../marker/markerStore';
import { dataConfig } from '../dataConfig/dataConfig';
import { FULFILLED } from 'mobx-utils'
//import { scaleLinear, scaleSqrt, scaleLog, scalePoint, scaleOrdinal, schemeCategory10, extent, set } from 'd3'

const scales = {
    "linear": d3.scaleLinear,
    "log": d3.scaleLog,
    "sqrt": d3.scaleSqrt,
    "ordinal": d3.scaleOrdinal,
    "point": d3.scalePoint,
    "band": d3.scaleBand
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

        return observable(dataConfig(cfg, this));
    },
    get scale() {
        if (isString(this.config.scale.ref))
            return resolveRef(this.config.scale);

        return observable(Object.defineProperties({}, {
            parent: { value: this, enumerable: true },
            config: { value: this.config.scale, enumerable: true },
            data: { value: this.data, enumerable: true },
            type: { get: this.scaleType, enumerable: true },
            domain: { get: this.domain, enumerable: true },
            range: { get: this.range, enumerable: true },
        }));
    },
    // ordinal, point or band
    ordinalScale: "ordinal",
    scaleType() {
        const concept = this.data.conceptProps;
        let scaleType = null;
        if (scales[this.config.type])
            scaleType = this.config.type;
        else if (concept.scales)
            scaleType = JSON.parse(concept.scales)[0];
        else if (["entity_domain", "entity_set", "string"].includes(concept.concept_type))
            scaleType = this.parent.ordinalScale;
        else
            scaleType = "linear";
        return scaleType;
    },
    range() {
        if (this.config.range != null)
            return this.config.range

        // default
        return (this.type == "ordinal") ?
            d3.schemeCategory10 : [0, 1];
    },
    domain() {
        if (this.config.domain != null)
            return this.config.domain

        // default to unique values or extent, depending on scale
        const which = this.parent.data.concept;
        return (["ordinal", "point"].includes(this.type)) ?
            d3.set(this.parent.data.response, d => d[which]).values().sort() :
            d3.extent(this.parent.data.response, d => d[which]);
    },
    processRow(row) {
        return row[this.data.concept];
    },
    get d3Scale() {
        const scale = scales[this.scale.type]();
        const domain = (this.scale.type == "log" && this.scale.domain[0] == 0) ? [1, this.scale.domain[1]] : this.scale.domain;
        return scale.range(this.scale.range).domain(domain);
    },
    setWhich: action('setWhich', function(kv) {
        const concept = this.data.source.getConcept(kv.value.concept);

        this.config.data.concept = concept.concept;
        this.config.data.space = kv.key;
        this.config.scale.domain = null;
        this.config.scale.range = null;
        this.config.scale.type = null;
    }),
}

export function baseEncoding(config) {
    config = deepmerge.all([{}, defaultConfig, config]);
    return assign({}, functions, configurable, { config });
}