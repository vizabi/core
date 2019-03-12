import { markerStore } from './marker/markerStore'
import { encodingStore } from './encoding/encodingStore'
import { dataSourceStore } from './dataSource/dataSourceStore'
import * as utils from './utils'
import { observable } from 'mobx';

export const stores = {
    markers: markerStore,
    dataSources: dataSourceStore,
    encodings: encodingStore
}

let config;

const vizabi = function(cfg) {
    config = observable(cfg);

    dataSourceStore.setMany(config.dataSources || {});
    encodingStore.setMany(config.encodings || {});
    markerStore.setMany(config.markers || {});

    return { stores, config };
}
vizabi.utils = utils;
vizabi.stores = stores;
vizabi.dataSource = (cfg, id) =>{
    // shortcut giving data directly in array-object format: [{...},{...}]
    if (Array.isArray(cfg)) {
        cfg = {
            values: cfg
        };
    }

    // create observable cfg and prevent deep observable on values
    const decorator = {};
    if ("values" in cfg) decorator.values = observable.ref;
    cfg = observable(cfg, decorator); 

    return dataSourceStore.set(cfg, id);
} 
vizabi.marker = (cfg, id) => {
    cfg = observable(cfg);
    return markerStore.set(cfg, id);
}

export default vizabi;

/**
 * 
 * @param {*} possibleRef 
 * @returns config Config object as described in reference config
 */
export function resolveRef(possibleRef) {
    // no ref
    if (!possibleRef || typeof possibleRef.ref === "undefined")
        return possibleRef

    // handle config shorthand
    let ref = (utils.isString(possibleRef.ref)) ? { config: possibleRef.ref } : possibleRef.ref;

    // invalid ref
    if (!(ref.config || ref.model)) {
        console.warn("Invalid reference, expected string reference in ref, ref.model or ref.config", possibleRef);
    }

    if (ref.config) {
        // user set config only
        return resolveTreeRef(ref.config, config);
    } else {
        // model ref includes resolved defaults
        const model = resolveTreeRef(ref.model, stores);
        return transformModel(model, ref.transform);
    }
}

function resolveTreeRef(refStr, tree) {
    const ref = refStr.split('.');
    let node = tree;
    for (let i = 0; i < ref.length; i++) {
        let child = ref[i];
        if (typeof node == "undefined") {
            console.warn("Couldn't resolve reference " + refStr);
            return null;
        }
        if (typeof node.get == "function")
            node = node.get(child);
        else
            node = node[child];
    }
    return node;
}

function transformModel(model, transform) {
    switch (transform) {
        case "entityConcept":
            return observable({
                space: [model.data.concept],
                filter: {
                    dimensions: {
                        [model.data.concept]: {
                            [model.data.concept]: { $in: model.scale.domain }
                        }
                    }
                },
                source: "gap"
            });
        default:
            // build new config based on model.config
            break;
    }
}