import { baseMarker } from './baseMarker';

export function bubble(config) {
    return observable(bubble.nonObservable(config));
}
bubble.nonObservable = function(config) {
    return baseMarker.nonObservable(config);
}
bubble.decorate = baseMarker.decorate;