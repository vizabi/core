import { baseMarker } from './baseMarker';
import { applyDefaults, renameProperty, assign } from '../utils';
import { action } from 'mobx';
import { encodingStore } from '../encoding/encodingStore';

const defaultConfig = {
    important: ["x", "y", "size"],
}

export function bubble(config) {
    const base = baseMarker(config);

    applyDefaults(config, defaultConfig);
    renameProperty(base, "encoding", "superEncoding");

    return assign(base, {
        get encoding() {
            const enc = this.superEncoding;
            enc.set('highlighted', encodingStore.getByDefinition({ type: "selection" }));
            enc.set('superhighlighted', encodingStore.getByDefinition({ type: "selection" }));
            return enc;
        },
        toggleSelection: action(function(d) {
            const frame = this.encoding.get('frame');
            if (!frame.trail.data.filter.has(d)) {
                frame.trail.setTrail(d);
            } else {
                frame.trail.deleteTrail(d);
            }
        })
    })

}

bubble.decorate = baseMarker.decorate;