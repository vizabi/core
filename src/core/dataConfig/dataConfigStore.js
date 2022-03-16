import { createStore } from '../genericStore'
import { dataConfig } from './dataConfig'
import { entityPropertyDataConfig } from './entityPropertyDataConfig'
import { entityMembershipDataConfig } from './entityMembershipDataConfig'

export const dataConfigStore = createStore(dataConfig, {
    entityPropertyDataConfig,
    entityMembershipDataConfig
});