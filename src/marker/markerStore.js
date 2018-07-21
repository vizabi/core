import { createStore } from '../genericStore'
import { baseMarker } from './baseMarker'
import { bubble } from './bubble'
import { reaction } from 'mobx'

export const markerStore = createStore(baseMarker, { bubble });

const markerConfig = {
    "bubble": {
        type: "bubble",
        space: ["geo", "time"],
        trails: {
            show: true,
            start: 1800
        },
        encoding: {
            // "markerProperty": "encoding definition"
            "x": {
                type: "x",
                which: "GDP",
                dataSource: "gap",
                scale: "log"
            },
            "y": {
                type: "y",
                which: "LEX",
                dataSource: "gap",
                scale: "linear"
            },
            "size": {
                type: "size",
                which: "POP",
                dataSource: "gap",
                scale: "sqrt"
            },
            "color": {
                type: "color",
                which: "world_region",
                dataSource: "gap",
                scale: "ordinal",
                range: "schemeCategory10"
            },
            "frame": {
                type: "frame",
                which: "time",
                dataSource: "gap",
                value: 1800,
                interpolate: true,
                speed: 100
            }
        }
    }
}

markerStore.setMany(markerConfig);

export default window.markerStore = markerStore;