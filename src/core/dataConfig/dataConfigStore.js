import { createStore } from '../genericStore'
import { dataConfig } from './dataConfig'
import { entityPropertyDataConfig } from './entityPropertyDataConfig'

export const dataConfigStore = createStore(dataConfig, {
    entityPropertyDataConfig,
});