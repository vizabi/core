import { baseDataSource } from './baseDataSource'
import { createStore } from '../genericStore'

export const dataSourceStore = createStore(baseDataSource);

const dataSourceConfig = {
    gap: {
        file: "fullgap.gapodd.csv",
        space: ["geo", "time"],
        /*transforms: [{
            type: "interpolate",
            dimension: "time",
            step: 1,
            concepts: ["POP", "GDP", "LEX", "world_region"],
        }]*/
    },
    soder: {
        file: "soder.csv"
    }
}

dataSourceStore.setMany(dataSourceConfig);