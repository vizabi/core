import { createStore } from '../genericStore'
import { baseMarker } from './baseMarker'
import { bubble } from './bubble'

export const markerStore = createStore(baseMarker, { bubble });