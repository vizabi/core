import { action, observable } from "mobx"
import { assign, isNonNullObject } from "../utils";
import { configurable } from '../configurable';
import { markerStore } from '../marker/markerStore';
import { dataConfigStore } from '../dataConfig/dataConfigStore';
import { scaleStore } from '../scale/scaleStore';
import { applyDefaults, createConfig } from "../config/config";


export function encoding(config, parent, name) {
    return observable(
        encoding.nonObservable(createConfig(config), parent, name),
        { config: observable.ref }
    );
}

encoding.nonObservable = function(config, parent, name) {
    //console.warn('creating new encoding', name, config);

    applyDefaults(config, {
        scale: {},
        data: {}
    });

    const functions = {
        get marker() {
            //trace();
            return this.parent;
            const marker = markerStore.getMarkerForEncoding(this);
            if (marker == null) console.warn("Couldn't find marker model for encoding.", { encoding: this });
            return marker;
        },
        get name() {
            return this.marker.getEncodingName(this);
        },
        get path() {
            return this.marker.path + '.encoding.' + this.name;
        },   
        get data() {
            const data = this.config.data;
            return dataConfigStore.get(data, this);
        },
        get state() {
            return this.data.state;
        },
        get scale() {
            // console.warn('recalculating scale', this.name);
            const scale = this.config.scale;
            return scaleStore.get(scale, this);
        },
        setWhich: action('setWhich', function(kv) {
            const concept = isNonNullObject(kv.value) ? kv.value.concept : kv.value;
            this.data.config.concept = concept;
            this.data.config.space = kv.key;
            this.scale.config.domain = null;
            this.scale.config.type = null;
        }),
        destruct() {
            this.data.destruct();
        }
    }

    return assign({}, functions, configurable, { config, parent });
}