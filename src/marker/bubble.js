import { baseMarker } from './baseMarker';
import { defaultDecorator } from '../utils';
import { action } from 'mobx';

const defaultConfig = {
    important: ["x", "y", "size"],
}

export const bubble = defaultDecorator({
    base: baseMarker,
    defaultConfig,
    functions: {
        toggleSelection: action(function(d) {
            const sel = this.encoding.get('selected');
            const frame = this.encoding.get('frame');
            if (!frame.trails.has(d)) {
                frame.trails.setTrail(d);
            } else {
                frame.trails.delete(d);
            }
        })
    }
});

bubble.decorate = baseMarker.decorate;