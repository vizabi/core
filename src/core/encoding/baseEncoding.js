import { action, trace } from 'mobx';
import { assign, applyDefaults } from "../utils";
import { configurable } from '../configurable';
import { markerStore } from '../marker/markerStore';
import { dataConfigStore } from '../dataConfig/dataConfigStore';
import { scaleStore } from '../scale/scaleStore';
import { resolveRef } from '../vizabi';
//import { scaleLinear, scaleSqrt, scaleLog, scalePoint, scaleOrdinal, schemeCategory10, extent, set } from 'd3'

const defaultConfig = {
    scale: {},
    data: {}
}

const functions = {
    get marker() {
        return this.parent;
    },
    get name() {
        return this.marker.getEncodingName(this);
    },
    get data() {
        const data = resolveRef(this.config.data);
        return dataConfigStore.get(data, this);
    },
    get scale() {
        // console.warn('recalculating scale', this.name);
        const scale = resolveRef(this.config.scale);
        return scaleStore.get(scale, this);
    },
    setWhich: action('setWhich', function(kv) {        
        if (kv.key) {
            //check ds
            const markerDS = this.marker.config.data.source;
            if (kv.value.dataSource == markerDS) {
                delete this.config.data.source;
            } else {
                this.config.data.source = kv.value.dataSource;
            }

            const concept = this.data.source.getConcept(kv.value.concept);

            this.config.data.concept = concept.concept;        
            this.config.data.space = kv.key;
            delete this.config.data.constant;
        } else {
            this.config.data.constant = kv.value.concept;
            delete this.config.data.concept;
            //delete this.config.data.space;
        }

        this.config.scale.domain = null;
        this.config.scale.type = null;
        this.config.scale.zoomed = null;
        this.config.scale.palette = {};
    }),
    get prop() {
        return this.marker.getPropForEncoding(this);
    }
}
export function baseEncoding(config, parent, name) {
    return observable(
        baseEncoding.nonObservable(observable(config), parent, name),
        { config: observable.ref }
    );
}

baseEncoding.nonObservable = function(config, parent, name) {
    //console.warn('creating new encoding', name, config);
    applyDefaults(config, defaultConfig);
    return assign({}, functions, configurable, { config, parent });
}