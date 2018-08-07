import { createStore } from '../genericStore'
import { baseMarker } from './baseMarker'
import { bubble } from './bubble'

export const markerStore = createStore(baseMarker, { bubble });
markerStore.getMarkerForEncoding = function(enc) {
    return this.getAll().find(marker => {
        return [...marker.encoding.values()].some(encoding => enc === encoding);
    }) || null;
}