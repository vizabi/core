import { markerStore } from './marker/markerStore'
import { encodingStore } from './encoding/encodingStore'
import { dataSourceStore } from './dataSource/dataSourceStore'
import { isString } from './utils'

export const stores = {
    marker: markerStore,
    dataSource: dataSourceStore,
    encoding: encodingStore
}

let config;

export const vizabi = function(cfg) {
    config = cfg;

    dataSourceStore.setMany(cfg.dataSource || {});
    encodingStore.setMany(cfg.encoding || {});
    markerStore.setMany(cfg.marker || {});

    return { stores };
}
vizabi.stores = stores;

export function resolveRef(possibleRef) {
    if (!isString(possibleRef.ref))
        return possibleRef

    const ref = possibleRef.ref.split('.');
    let model = stores;
    for (let i = 0; i < ref.length; i++) {
        let child = ref[i];
        if (typeof model == "undefined") {
            console.warn("Couldn't resolve reference " + possibleRef.ref);
            return null;
        }
        if (typeof model.get == "function")
            model = model.get(child);
        else
            model = model[child];
    }
    return model;
}

export function resolveRefCfg(possibleRef) {
    // no ref
    if (!isString(possibleRef.ref))
        return possibleRef

    // reference
    const ref = possibleRef.ref.split('.');
    let model = config;
    for (let i = 0; i < ref.length; i++) {
        let child = ref[i];
        if (typeof model == "undefined") {
            console.warn("Couldn't resolve reference " + possibleRef.ref);
            return null;
        }
        model = model[child];
    }
    return model;
}