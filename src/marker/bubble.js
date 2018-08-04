import { baseMarker } from './baseMarker';
import { assign, deepmerge, moveProperty } from '../utils';
import { extent } from 'd3'

const functions = {
    get trails() { return this.config.trails },
    addTrails: function(frameMap) {
        if (!this.trails.show)
            return frameMap;

        const frame = this.encoding.get('frame');

        // can't use frame.domain because of cycle frame.domain -> frameMap -> frame.domain
        const [minFrame, maxFrame] = extent([...frameMap.keys()]);
        if (!maxFrame)
            return frameMap;

        // for each frame that features in trail, add its markers to frames before it
        // hi -> lo so trailFrames only contain their own markers (no other trails)
        const trailsStart = (minFrame > this.trails.start) ? minFrame : this.trails.start;
        for (let i = maxFrame - 1; i >= trailsStart; i--) {
            const trailFrame = frameMap.get(i);
            for (let markerKey of this.encoding.get('selected').markerKeys) {
                const markerData = trailFrame.get(markerKey);
                const newKey = markerKey + '-' + frame.which + '-' + i;
                const newData = Object.assign({}, markerData, {
                    [Symbol.for('key')]: newKey,
                    [Symbol.for('trail')]: true,
                    [Symbol.for('trailHeadKey')]: markerKey
                });
                for (let j = i + 1; j <= maxFrame; j++) {
                    frameMap
                        .get(j)
                        .set(newKey, newData);
                }
            }
        }
        return frameMap;
    }
}

const defaultConfig = {
    important: ["x", "y", "size"],
    trails: {
        show: false,
        start: null,
    },
    selections: {
        select: {},
        highlight: {},
        show: {},
        superhighlight: {}
    }
}

export function bubble(config) {

    config = deepmerge.all([{}, defaultConfig, config]);

    function decorate(baseMarker) {
        // make baseMarker.frameMap available on bubbleMarker
        moveProperty(baseMarker, 'frameMap', functions, 'baseFrameMap');
        return assign(baseMarker, functions, {
            get frameMap() {
                // decorate frameMap with trails
                //return this.baseFrameMap;
                return this.addTrails(this.baseFrameMap);
            }
        });
    }

    return decorate(baseMarker(config));
}