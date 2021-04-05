import { baseMarker } from './baseMarker';
import { applyDefaults, renameProperty, assign } from '../utils';
import { action } from 'mobx';
import { encodingStore } from '../encoding/encodingStore';

const defaultConfig = {
    requiredEncodings: ["x", "y", "size"],
    encoding: {
        size: { scale: { modelType: "size" } }
    }
}

export function bubble(config) {
    return observable(bubble.nonObservable(config));
}
bubble.nonObservable = function(config) {
    applyDefaults(config, defaultConfig);

    return baseMarker.nonObservable(config);
}
bubble.decorate = baseMarker.decorate;