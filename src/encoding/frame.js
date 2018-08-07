import { baseEncoding } from './baseEncoding';
import { action, reaction, trace } from 'mobx'
import { resolveRef } from '../vizabi';
import { assign, deepmerge, createKey, isString } from '../utils';
//import { interpolate, extent } from 'd3';

const defaultConfig = {
    type: "frame",
    value: (new Date()).getFullYear(),
    speed: 100,
    interpolate: true,
    trails: {
        show: false,
        start: null,
        markers: []
    }
}

const functions = {
    get value() { return this.config.value },
    get speed() { return this.config.speed },
    domain() {
        if (this.config.scale.domain || this.frameMapCache == null) return this.config.scale.domain;
        return d3.extent([...this.frameMapCache.keys()]);
    },
    get trails() {
        const cfg = this.config.trails;
        return {
            show: cfg.show,
            start: cfg.start,
            markers: resolveRef(cfg.markers)
        }
    },
    get interpolate() { return this.config.interpolate },
    playing: false,
    timeout: null,
    togglePlaying() {
        this.playing ?
            this.stopPlaying() :
            this.startPlaying();
    },
    startPlaying: function() {
        if (this.value == this.scale.domain[1])
            this.setValue(this.scale.domain[0]);

        this.setPlaying(true);
    },
    stopPlaying: function() {
        this.setPlaying(false);
    },
    setPlaying: ('setPlaying', function(playing) {
        this.playing = playing;
    }),
    setSpeed: action('setSpeed', function(speed) {
        speed = Math.max(0, speed);
        this.config.speed = speed;
    }),
    setValue: action('setValue', function(value) {
        if (value != null) {
            const domain = this.scale.domain;
            value = Math.min(Math.max(value, domain[0]), domain[1]);
        }
        this.config.value = value;
    }),
    setValueAndStop: action('setValueAndStop', function(value) {
        this.stopPlaying();
        this.setValue(value);
    }),
    update: action('update frame value', function() {
        if (this.playing) {
            const newValue = this.value + 1;
            this.setValue(newValue);
            if (newValue > this.scale.domain[1])
                this.stopPlaying();
            // used for timeout instead of interval timing
            //else this.timeout = setTimeout(this.update.bind(this), this.speed);
        }
    }),
    get frameMap() {
        //trace();
        // loading
        if (this.marker.dataMapCache == null)
            return null;

        if (this.trails.show)
            return this.trailedFrameMap;
        else
            return this.frameMapCache;
    },
    get frameMapArray() {
        //trace();
        if (this.frameMap == null)
            return null;

        const frames = new Map();
        for (let [frameId, markers] of this.frameMap) {
            frames.set(frameId, [...markers.values()]);
        }
        return frames;
    },
    get currentFrame() { return this.currentFrameFromMap(this.frameMap, new Map()) },
    get currentFrameArray() { return this.currentFrameFromMap(this.frameMapArray, []) },
    currentFrameFromMap(map, empty) {
        //trace();
        if (map == null)
            return null;

        if (map.has(this.value)) {
            return map.get(this.value);
        } else {
            console.warn("Frame value not found in frame map", this)
            return empty;
        }
    },
    get frameMapCache() {
        const flatDataMap = this.marker.dataMapCache;
        if (flatDataMap == null)
            return null;

        const frameMap = new Map();
        const frameSpace = this.data.space.filter(dim => dim != this.data.concept);
        for (let [key, row] of flatDataMap) {
            const dataMap = this.getOrCreateDataMap(frameMap, row);
            const key = createKey(frameSpace, row);
            row[Symbol.for('key')] = key;
            dataMap.set(key, row);
        }
        if (this.interpolate)
            this.interpolateFrames(frameMap, frameSpace);

        const orderEnc = this.marker.encoding.get("order");
        if (orderEnc)
            for (let [k, frame] of frameMap)
                frameMap.set(k, orderEnc.order(frame));

        return frameMap;
    },
    getOrCreateDataMap(frameMap, row) {
        let dataMap;
        if (frameMap.has(row[this.data.concept])) {
            dataMap = frameMap.get(row[this.data.concept]);
        } else {
            dataMap = new Map();
            frameMap.set(row[this.data.concept], dataMap);
        }
        return dataMap;
    },
    // basically transpose and filter framemap
    get trailedFrameMap() {
        const frameMap = this.frameMapCache;
        const markerKeys = this.trails.markers;

        if (frameMap == null)
            return null;
        if (markerKeys.length == 0)
            return frameMap;

        const [minFrameId, maxFrameId] = this.scale.domain;

        // create trails
        const trails = new Map();
        for (let key of markerKeys) {
            const trail = new Map();
            trails.set(key, trail);
            for (let [i, frame] of frameMap) {
                if (frame.has(key))
                    trail.set(i, frame.get(key));
            }
        }

        // add trails to frames
        const newFrameMap = new Map();
        for (let [id, frame] of frameMap) {
            const newFrame = new Map();
            for (let [markerKey, markerData] of frame) {
                // insert trails before its head marker
                if (trails.has(markerKey)) {
                    const trail = trails.get(markerKey);
                    const trailStart = (minFrameId > this.trails.start) ? minFrameId : this.trails.start;
                    // add trail markers in ascending order
                    for (let i = trailStart; i < id; i++) {
                        const trailMarker = trail.get(i);
                        const newKey = markerKey + '-' + this.data.concept + '-' + i;
                        const newData = Object.assign({}, trailMarker, {
                            [Symbol.for('key')]: newKey,
                            [Symbol.for('trailHeadKey')]: markerKey
                        });
                        newFrame.set(newKey, newData);
                    }
                }
                // (head) marker
                newFrame.set(markerKey, markerData);
            }
            newFrameMap.set(id, newFrame);
        }
        return newFrameMap;
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
                                            [this.data.concept]: frameId
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
        const int = d3.interpolate(start.value, end.value);
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
            () => { return { playing: this.playing, speed: this.speed } },
            ({ playing, speed }) => {
                clearInterval(this.playInterval);
                if (playing) {
                    this.update();
                    this.playInterval = setInterval(this.update.bind(this), speed);
                }
            }, { name: "frame" }
        );
    }
}

export function frame(config) {
    config = deepmerge.all([{}, defaultConfig, config]);
    return assign(baseEncoding(config), functions);
}