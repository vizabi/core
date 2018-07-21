import { baseEncoding } from './baseEncoding';
import { action, reaction } from 'mobx'
import { assign, deepmerge, createKey } from '../utils';
import { interpolate } from 'd3';

const defaultConfig = {
    value: (new Date()).getFullYear(),
    speed: 100,
    interpolate: true
}

const functions = {
    get value() { return this.config.value },
    get speed() { return this.config.speed },
    get interpolate() { return this.config.interpolate },
    playing: false,
    timeout: null,
    startPlaying: action('startPlaying', function() {
        if (this.value == this.domain[1])
            this.config.value = this.domain[0];
        this.playing = true;
    }),
    stopPlaying: action('stopPlaying', function() {
        this.playing = false;
    }),
    setValueAndStop: action('setValueAndStop', function(value) {
        this.stopPlaying();
        this.config.value = value;
    }),
    update: action('update frame value', function() {
        if (this.playing) {
            this.config.value++;
            if (this.value == this.domain[1])
                this.stopPlaying();
            // used for timeout instead of interval timing
            // else this.timeout = setTimeout(this.update.bind(this), this.speed);
        }
    }),
    createFrameMap: function(flatDataMap, space) {
        const frameMap = new Map();
        const frameSpace = space.filter(dim => dim != this.which);
        for (let [key, row] of flatDataMap) {
            const dataMap = this.getOrCreateDataMap(frameMap, row);
            const key = createKey(frameSpace, row);
            row[Symbol.for('key')] = key;
            dataMap.set(key, row);
        }
        if (this.interpolate)
            this.interpolateFrames(frameMap, frameSpace);
        return frameMap;
    },
    getOrCreateDataMap(frameMap, row) {
        let dataMap;
        if (frameMap.has(row[this.which])) {
            dataMap = frameMap.get(row[this.which]);
        } else {
            dataMap = new Map();
            frameMap.set(row[this.which], dataMap);
        }
        return dataMap;
    },
    interpolateFrames(frameMap, frameSpace) {

        var frames = [...frameMap.keys()].sort();
        var previousMarkerValues = new Map();
        // for each frame
        frames.forEach(frameId => {
            // for each marker in that frame
            for (let [markerKey, marker] of frameMap.get(frameId).entries()) {

                // get previous values for this marker
                let previous;
                if (!previousMarkerValues.has(markerKey)) {
                    previous = {};
                    previousMarkerValues.set(markerKey, previous);
                } else {
                    previous = previousMarkerValues.get(markerKey);
                }

                // for every property on marker
                Object.keys(marker)
                    // remove properties without data
                    .filter(prop => marker[prop] != null)
                    .forEach(prop => {
                        // if there is a previous value and gap is > 1
                        if (previous[prop] && previous[prop].frameId + 1 < frameId) {
                            // interpolate and save results in frameMap
                            this.interpolatePoint(previous[prop], { frameId, value: marker[prop] })
                                .forEach(({ frameId, value }) => {
                                    // could maybe be optimized with batch updating all interpolations
                                    let markerObj;
                                    let markerMap;

                                    // get right frame
                                    if (frameMap.has(frameId)) {
                                        markerMap = frameMap.get(frameId);
                                    } else {
                                        markerMap = new Map();
                                        frameMap.set(frameId, markerMap);
                                    }

                                    // get right marker
                                    if (markerMap.has(markerKey)) {
                                        markerObj = markerMap.get(markerKey);
                                    } else {
                                        markerObj = {
                                            [Symbol.for('key')]: markerKey,
                                            [this.which]: frameId
                                        }
                                        frameSpace.forEach(dim => markerObj[dim] = marker[dim]);
                                        markerMap.set(markerKey, markerObj);
                                    }

                                    // add value to marker
                                    markerObj[prop] = value;
                                });
                        }

                        // update previous value to current
                        previous[prop] = {
                            frameId,
                            value: marker[prop]
                        }
                    });


            }
        });
    },
    interpolatePoint(start, end) {
        const int = interpolate(start.value, end.value);
        const delta = end.frameId - start.frameId;
        const intVals = [];
        for (let i = 1; i < delta; i++) {
            const frameId = start.frameId + i;
            const value = int(i / delta);
            intVals.push({ frameId, value })
        }
        return intVals;
    },
    setUpReactions() {
        const controlTimer = reaction(
            // mention all observables (state & computed) which you want to be tracked
            // if not tracked, they will always be recomputed, their values are not cached
            () => { return { playing: this.playing, speed: this.speed, domain: this.domain } },
            ({ playing, speed }) => {
                this.timeout = clearInterval(this.timeout);
                if (playing) {
                    this.update();
                    this.timeout = setInterval(this.update.bind(this), speed);
                }
            }
        );
    }
}

export function frame(config) {
    config = deepmerge.all([{}, defaultConfig, config]);
    return assign(baseEncoding(config), functions);
}