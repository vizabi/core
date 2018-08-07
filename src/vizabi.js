import { markerStore } from './marker/markerStore'
import { encodingStore } from './encoding/encodingStore'
import { dataSourceStore } from './dataSource/dataSourceStore'
import { isString } from './utils'

export const stores = {
    marker: markerStore,
    dataSource: dataSourceStore,
    encoding: encodingStore
}

export const vizabi = function(config) {
    dataSourceStore.setMany(config.dataSources || {});
    encodingStore.setMany(config.encodings || {});
    markerStore.setMany(config.markers || {});

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