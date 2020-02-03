import { action, trace } from 'mobx';
import { assign, applyDefaults } from "../utils";
import { configurable } from '../configurable';
import { markerStore } from '../marker/markerStore';
import { dataConfigStore } from '../dataConfig/dataConfigStore';
import { scaleStore } from '../scale/scaleStore';
//import { scaleLinear, scaleSqrt, scaleLog, scalePoint, scaleOrdinal, schemeCategory10, extent, set } from 'd3'

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
    get name() {
        return this.marker.getEncodingName(this);
    },
    get data() {
        //return dataConfigStore.getByDefinition([ ['config', this.config.data ], ['marker', this.marker.data] ]);
        return dataConfigStore.getByDefinition(this.config.data, this);
    },
    get scale() {
        return scaleStore.getByDefinition(this.config.scale, this);
    },
    setWhich: action('setWhich', function(kv) {
        const concept = this.data.source.getConcept(kv.value.concept);

        this.config.data.concept = concept.concept;
        this.config.data.space = kv.key;
        this.config.scale.domain = null;
        this.config.scale.type = null;
    }),
    get prop() {
        return this.marker.getPropForEncoding(this);
    }
}

export function baseEncoding(config, parent) {
    applyDefaults(config, defaultConfig);
    console.log('creating new encoding', config);
    return assign({}, functions, configurable, { config, parent });
}