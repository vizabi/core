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
    const base = baseMarker.nonObservable(config);

    applyDefaults(config, defaultConfig);

    return assign(base, {
        toggleSelection: action(function(d) {
            const trails = this.encoding.trail;
            if (!trails.data.filter.has(d)) {
                trails.setTrail(d);
            } else {
                trails.deleteTrail(d);
            }
        })
    })
}

bubble.decorate = baseMarker.decorate;