import { markerStore } from './marker/markerStore'
import { encodingStore } from './encoding/encodingStore'
import { dataSourceStore } from './dataSource/dataSourceStore'
import * as utils from './utils'
import { observable } from 'mobx';
import * as mobx from 'mobx';

export const stores = {
    markers: markerStore,
    dataSources: dataSourceStore,
    encodings: encodingStore
}

const vizabi = function(cfg) {
    const config = observable(cfg);

    const models = {};
    for (const storeName in config) {
        if (storeName in stores) {
            models[storeName] = stores[storeName].createMany(config[storeName])
        } else {
            console.warn('Vizabi() was given an unknown store name: ', storeName);
        }
    }
    models.config = config;
    
    return models;

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

    return dataSourceStore.create(cfg, null, id);
} 
vizabi.marker = (cfg, id) => {
    cfg = observable(cfg);
    return markerStore.create(cfg, null, id);
}
vizabi.encoding = (cfg, id) => {
    cfg = observable(cfg);
    return encodingStore.create(cfg, null, id);
}

export default vizabi;