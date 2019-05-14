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
    const base = baseMarker(config);

    applyDefaults(config, defaultConfig);
    renameProperty(base, "encoding", "superEncoding");

    return assign(base, {
        get encoding() {
            const enc = this.superEncoding;
            enc.set('highlighted', encodingStore.getByDefinition({ modelType: "selection" }));
            enc.set('superhighlighted', encodingStore.getByDefinition({ modelType: "selection" }));
            return enc;
        },
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

bubble.decorate = baseMarker.decorate;