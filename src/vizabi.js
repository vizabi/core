import { markerStore } from './marker/markerStore'
import { encodingStore } from './encoding/encodingStore'
import { dataSourceStore } from './dataSource/dataSourceStore'
import { isString } from './utils'
import { observable } from 'mobx';

export const stores = {
    marker: markerStore,
    dataSource: dataSourceStore,
    encoding: encodingStore
}

let config;

export const vizabi = function(cfg) {
    config = observable(cfg);

    dataSourceStore.setMany(cfg.dataSource || {});
    encodingStore.setMany(cfg.encoding || {});
    markerStore.setMany(cfg.marker || {});

    return { stores };
}
vizabi.stores = stores;
vizabi.config = config;

/**
 * 
 * @param {*} possibleRef 
 * @returns config Config object as described in reference config
 */
export function resolveRef(possibleRef) {
    let ref;
    // no ref
    if (!possibleRef.ref)
        return possibleRef

    // handle shorthand
    ref = (isString(possibleRef.ref)) ? { config: possibleRef.ref } : possibleRef.ref;

    // invalid ref
    if (!(ref.config || ref.model)) {
        console.warn("Invalid reference, expected string reference in ref, ref.model or ref.config", possibleRef);
    }

    if (ref.config) {
        return resolveTreeRef(ref.config, config);
    } else {
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