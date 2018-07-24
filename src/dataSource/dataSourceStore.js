import { baseDataSource } from './baseDataSource'
import { createStore } from '../genericStore'

export const dataSourceStore = createStore(baseDataSource);