import { markerStore } from './marker/markerStore'
import { encodingStore } from './encoding/encodingStore'
import { dataSourceStore } from './dataSource/dataSourceStore'
import * as utils from './utils'
import * as mobx from 'mobx';
import { createConfig } from './config';

export const stores = {
    markers: markerStore,
    dataSources: dataSourceStore,
    encodings: encodingStore
}

let config;

const vizabi = function(cfg) {
    config = createConfig(cfg, { model: stores });

    dataSourceStore.setMany(config.dataSources || {});
    encodingStore.setMany(config.encodings || {});
    markerStore.setMany(config.markers || {});

    return { stores, config };
}
vizabi.mobx = mobx;
vizabi.utils = utils;
vizabi.stores = stores;
vizabi.dataSource = (cfg, id) =>{
    // shortcut giving data directly in array-object format: [{...},{...}]
    if (Array.isArray(cfg)) {
        cfg = {
            values: cfg
        };
    }

    return dataSourceStore.set(cfg, id);
} 
vizabi.marker = (cfg, id) => {
    cfg = createConfig(cfg);
    return markerStore.set(cfg, id);
}

export default vizabi;