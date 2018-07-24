import { markerStore } from './marker/markerStore'
import { encodingStore } from './encoding/encodingStore'
import { dataSourceStore } from './dataSource/dataSourceStore'

export const vizabi = function(config) {
    dataSourceStore.setMany(config.dataSources || {});
    encodingStore.setMany(config.encodings || {});
    markerStore.setMany(config.markers || {});

    return {
        markerStore,
        encodingStore,
        dataSourceStore
    }
}