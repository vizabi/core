import { baseMarker } from './baseMarker';
import { deepmerge } from '../utils';

const defaultConfig = {
    important: ["x", "y", "size"],
}

export function bubble(config) {

    config = deepmerge.all([{}, defaultConfig, config]);

    return baseMarker(config);
}

bubble.decorate = baseMarker.decorate;