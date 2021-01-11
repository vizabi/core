import { createStore } from '../genericStore'
import { marker } from './marker'
import { bubble } from './bubble'

export const markerStore = createStore(marker, { bubble });
markerStore.getMarkerForEncoding = function(enc) {
    return this.getAll().find(marker => {
        return [...marker.encoding.values()].some(encoding => enc === encoding);
    }) || null;
}