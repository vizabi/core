import { marker } from './marker';
import { renameProperty, assign } from '../utils';
import { action, trace, observable } from 'mobx';
import { applyDefaults } from '../config/config';

export function bubble(config) {
    return observable(bubble.nonObservable(config));
}

bubble.nonObservable = function(config) {

    applyDefaults(config, {
        requiredEncodings: ["x", "y", "size"],
        encoding: {
            size: { scale: { modelType: "size" } }
        }
    })

    const base = marker.nonObservable(config);

    return assign(base, {
        toggleSelection: action(function(d) {
            const trails = this.encoding.get('trail');
            if (!trails.data.filter.has(d)) {
                trails.setTrail(d);
            } else {
                trails.deleteTrail(d);
            }
        })
    })

}

bubble.decorate = marker.decorate;