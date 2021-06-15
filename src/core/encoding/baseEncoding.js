import { action, observable, trace } from 'mobx';
import { assign, applyDefaults, isNonNullObject, combineStates } from "../utils";
import { configurable } from '../configurable';
import { dataConfigStore } from '../dataConfig/dataConfigStore';
import { scaleStore } from '../scale/scaleStore';
import { resolveRef, isReference } from '../config';
//import { scaleLinear, scaleSqrt, scaleLog, scalePoint, scaleOrdinal, schemeCategory10, extent, set } from 'd3'

const defaultConfig = {
    scale: {},
    data: {}
}
export function baseEncoding(config, parent, name) {
    return observable(
        baseEncoding.nonObservable(observable(config), parent, name),
        { config: observable.ref }
    );
}

baseEncoding.nonObservable = function(config, parent, id) {
    //console.warn('creating new encoding', name, config);
    applyDefaults(config, defaultConfig);

    let currentDataConfig;

    const functions = {
        id, 
        get marker() {
            return this.parent;
        },
        get name() {
            if (this.marker)
                return this.marker.getEncodingName(this);
            else 
                return 'Unnamed'
        },
        get data() {
            const config = resolveRef(this.config.data).value;
            const dataConfig = dataConfigStore.get(config, this)
            if (currentDataConfig && dataConfig != currentDataConfig) {
                currentDataConfig.dispose();
            }
            return currentDataConfig = dataConfig;
        },
        get transformFields() {
            return [];
        },
        get scale() {
            // console.warn('recalculating scale', this.name);
            const scale = resolveRef(this.config.scale).value;
            return scaleStore.get(scale, this);
        },
        get references() {
            return Object.fromEntries(Object.entries(this.config)
                .filter(entry => isReference(entry[1]))
                .map(([key, ref]) => [ key , resolveRef(ref) ] )
            );
        },
        get referenceState() {
            return combineStates(Object.values(this.references).map(ref => ref.state))
        },
        get state() {
            return combineStates([this.data.state, this.referenceState]);
        },

        dataMapBeforeTransform(transformName) {
            const transformations = this.marker.transformations;
            const fullTransformName = this.name + "." + transformName;
            const transformIndex = transformations.findIndex(tObj => tObj.name == fullTransformName);
            return this.marker.getTransformedDataMap(transformations[transformIndex - 1].name);
        },
        
        setWhich: action('setWhich', function(kv) {        
            const concept = isNonNullObject(kv.value) ? kv.value.concept : kv.value;
            
            if (kv.key) {
                //check ds
                if (isNonNullObject(kv.value)) {
                    if (this.marker && kv.value.dataSource == this.marker.config.data.source) {
                        delete this.config.data.source;
                    } else {
                        this.config.data.source = kv.value.dataSource;
                    }
                }
    
                this.config.data.concept = concept;
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
        dispose() {
            for (const dispose of this.destructers) {
                dispose();
            }
            this.data.dispose();
            this.scale.dispose();
        },
        destructers: [],
        
    }

    return assign({}, functions, configurable, { config, parent });
}