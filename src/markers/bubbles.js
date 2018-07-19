import { baseMarker } from './base';
import { observable } from 'mobx'
import { assign, deepmerge } from './../utils';


const addTrails = function(frameMap) {
    if (!this.trails.show)
        return frameMap;

    const [minFrame, maxFrame] = d3.extent([...frameMap.keys()]);
    if (!maxFrame)
        return frameMap;

    // for each frame that features in trail, add its markers to frames before it
    // hi -> lo so trailFrames only contain their own markers (no other trails)
    const trailsStart = (minFrame > this.trails.start) ? minFrame : this.trails.start;
    for (let i = maxFrame - 1; i >= trailsStart; i--) {
        const trailFrame = frameMap.get(i);
        this.selected.forEach(markerKey => {
            const markerData = trailFrame.get(markerKey);
            const newKey = markerKey + '-' + i;
            const newData = Object.assign({}, markerData, {
                [Symbol.for('key')]: newKey
            });
            for (let j = i + 1; j <= maxFrame; j++) {
                frameMap
                    .get(j)
                    .set(newKey, newData);
            }
        });
    }
    return frameMap;
}


export function bubbles(config) {

    config = deepmerge({
        important: ["x", "y", "size"],
        trails: {
            show: false,
            start: null,
        }
    }, config);

    function decorate(marker) {
        // get the old frameMap calculation function
        const baseFrameMap = getBoundGetter(marker, 'frameMap');
        return assign(marker, {
            get frameMap() {
                // decorate frameMap with trails
                return this.addTrails(baseFrameMap());
            },
            get trails() { return this.config.trails },
            addTrails: addTrails
        });
    }

    return decorate(baseMarker(config));
}

// gets a getter accessor from an object and binds it to the object
// used to overload methods when decorating objects
function getBoundGetter(obj, prop) {
    return Object.getOwnPropertyDescriptor(obj, prop).get.bind(obj);
}

export default function bubbleMarker_observable(config) {
    return observable(bubbles(config));
}