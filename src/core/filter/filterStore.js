import { createStore } from '../genericStore'
import { filter } from './filter'
import { trailFilter } from './trailfilter'

export const filterStore = createStore(filter, {
    trailFilter
});