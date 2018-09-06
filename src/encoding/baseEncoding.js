import { action, toJS, trace, observable } from 'mobx';
import { assign, applyDefaults, createMarkerKey } from "../utils";
import { resolveRef } from '../vizabi';
import { configurable } from '../configurable';
import { markerStore } from '../marker/markerStore';
import { dataConfig } from '../dataConfig/dataConfig';
import { scales } from '../scale/scale';
//import { scaleLinear, scaleSqrt, scaleLog, scalePoint, scaleOrdinal, schemeCategory10, extent, set } from 'd3'

const createObj = (space, row, key) => {
    const obj = {
        [Symbol.for('key')]: key
    };
    space.forEach(dim => obj[dim] = row[dim])
    return obj;
}

const getOrCreateObj = (dataMap, space, row) => {
    let obj;
    const key = createMarkerKey(space, row);
    if (!dataMap.has(key)) {
        obj = createObj(space, row, key);
        dataMap.set(key, obj);
    } else {
        obj = dataMap.get(key);
    }
    return obj;
}

const defaultConfig = {
    scale: {},
    data: {}
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
        cfg = resolveRef(cfg);

        return observable(dataConfig(cfg, this));
    },
    get scale() {
        const config = resolveRef(this.config.scale);
        const parent = this;
        const scale = scales.get(config.modelType);
        return observable(scale(config, parent));
    },
    get hasOwnData() {
        return this.data && this.data.hasOwnData;
    },
    addPropertyToMarkers(dataMap, prop) {
        if (this.data && this.data.concept) {
            // simply copy from row key
            if (this.marker.data.space.includes(this.data.concept)) {
                const concept = this.data.concept;
                for (let row of dataMap.values()) {
                    row[prop] = row[concept];
                }
            } else {
                const commonSpace = this.data.commonSpace;
                const response = this.data.responseMap;
                const concept = this.data.concept;
                for (let row of dataMap.values()) {
                    const key = createMarkerKey(commonSpace, row);
                    // add data to marker if this encoding has data for it 
                    if (response.has(key)) {
                        row[prop] = response.get(key)[concept];
                    }
                }
            }
        }
    },
    createMarkersWithProperty(dataMap, prop) {
        const markerSpace = toJS(this.marker.data.space)
        const concept = this.data.concept;
        const response = this.data.response;
        const n = response.length

        // old school for loop fastest;
        for (let i = 0; i < n; i++) {
            let row = response[i];
            const obj = getOrCreateObj(dataMap, markerSpace, row);
            obj[prop] = row[concept];
        };
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

export function baseEncoding(config, parent) {
    applyDefaults(config, defaultConfig);
    return assign({}, functions, configurable, { config, parent });
}