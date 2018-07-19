import encodingStore from './encodingStore'
import { observable, action } from 'mobx'
import base from './markers/base'
import bubbles from './markers/bubbles'

const markerConfig = {
    "bubbles": {
        type: "bubbles",
        space: ["geo", "time"],
        trails: {
            show: true,
            start: 1800
        },
        encoding: {
            // "markerProperty": "encodingId"
            "x": "x",
            "y": "y",
            "size": "size",
            "color": "color",
            "frame": "frame"
        }
    }
}

const modelFactory = function(config) {
    // extend with type defaults
    switch (config.type) {
        case 'bubbles':
            return bubbles(config);
        default:
            return base(config);
    }
}

const modelStorage = observable({
    models: new Map(),
    get: function(id) {
        return this.models.get(id);
    },
    getAll: function() {
        return this.models;
    },
    has: function(id) {
        return this.models.has(id);
    },
    set: action(function(id, config) {
        this.models.set(id, modelFactory(config));
    }),
    setMany: action(function(configs) {
        for (let id in configs) {
            this.set(id, configs[id]);
        }
    })
});

modelStorage.setMany(markerConfig);


export default window.markerStore = modelStorage;