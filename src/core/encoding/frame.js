import { baseEncoding } from './baseEncoding';
import { action, reaction, trace } from 'mobx'
import { FULFILLED } from 'mobx-utils'
import { assign, createMarkerKey, applyDefaults, relativeComplement, configValue, parseConfigValue, equals, getTimeInterval, mapToObj } from '../utils';
import { encodingStore } from './encodingStore';
import DataFrame from '../../dataframe/dataFrame';
import { DataFrameGroup } from '../../dataframe/dataFrameGroup';
//import { interpolate, extent } from 'd3';

const defaultConfig = {
    modelType: "frame",
    value: null,
    scale: { modelType: "frame" },
    trail: { modelType: "trail" }
}

const defaults = {
    interpolate: true,
    loop: false,
    speed: 100,
    step: { unit: "index", size: 1 }
}

const functions = {
    get value() {
        let value;
        if (this.config.value != null) {
            value = parseConfigValue(this.config.value, this.data.conceptProps);
            value = this.scale.clampToDomain(value);
        } else {
            value = this.scale.domain[0];
        }
        return value; 
    },
    get index() {
        const value = this.value;
        return this.stepArray.findIndex(stepVal => equals(stepVal, value));
    },
    get stepArray() {
        return [...this.stepFn()];
    },
    get speed() { return this.config.speed || defaults.speed },
    get loop() { return this.config.loop || defaults.loop },
    get stepSize() { return this.config.step && this.config.step.size || defaults.step.size },
    get stepUnit() { return this.config.step && this.config.step.unit || this.getStepUnit() },
    getStepUnit() {
        const { concept, concept_type } = this.data.conceptProps;
        if (concept_type == 'measure') 
            return 'number';

        if (['string','entity_domain','entity_set'].includes(concept_type)) 
            return 'index';

        if (concept_type == 'time') {
            if (['year', 'month','day','hour','minute','second'].includes(concept)) {
                return concept;
            }
            if (concept == "time")
                return "year";
        }
        return defaults.step.unit;
    },
    get trail() {
        trace();
        const cfg = this.config.trail;
        return encodingStore.getByDefinition(cfg, this);
    },
    get interpolate() { return this.config.interpolate || defaults.interpolate },
    get stepFn() {
        const stepSize = this.stepSize;
        const stepUnit = this.stepUnit;
        const domain = this.scale.domain;
        let interval;
        if (interval = getTimeInterval(stepUnit)) {
            const prop = this.prop;
            return function* (min = domain[0], max = domain[1]) { 
                for (let i = min; i <= max; i = interval.offset(i, stepSize) )
                    yield i;
            };
        } else if (stepUnit === "number") {
            return function* (min = domain[0], max = domain[1]) { 
                for (let i = min; i <= max; i += stepSize)
                    yield i;
            };
        } else if (stepUnit === "index") {
            return function* (min, max = domain.length) {
                min = (min === undefined) ? 0 : domain.indexOf(min);
                for (let i = min; i < max; i += stepSize)
                    yield domain[i];
            }
        }
        console.warn("No valid step function found in frame.", this.config.step);
    },
    playing: false,
    nextValGen: null,
    togglePlaying() {
        this.playing ?
            this.stopPlaying() :
            this.startPlaying();
    },
    startPlaying: function() {
        if (equals(this.value, this.scale.domain[this.scale.domain.length-1]))
            this.setValue(this.scale.domain[0]);

        this.setPlaying(true);
    },
    stopPlaying: function() {
        this.setPlaying(false);
    },
    setPlaying: action('setPlaying', function(playing) {
        this.playing = playing;
    }),
    setSpeed: action('setSpeed', function(speed) {
        speed = Math.max(0, speed);
        this.config.speed = speed;
    }),
    setValue: action('setValue', function(value) {
        const concept = this.data.conceptProps;
        let date = value instanceof Date ? value : parseConfigValue(value, concept);
        const string = typeof value === "string" ? value : configValue(value, concept);
        if (date != null) {
            date = this.scale.clampToDomain(date);
        }
        this.config.value = string;
        this.updateTrailStart();
    }),
    setIndex: action('setIndex', function(idx) {
        this.setValue(this.stepArray[idx]);
    }),
    setValueAndStop: action('setValueAndStop', function(value) {
        this.stopPlaying();
        this.setValue(value);
    }),
    setIndexAndStop: action('setIndexAndStop', function(idx) {
        this.stopPlaying();
        this.setIndex(idx);
    }),
    update: action('update frame value', function() {
        if (this.playing && this.marker.dataPromise.state == FULFILLED) {
            const nxt = this.nextValGen.next();
            if (nxt.done) {
                if (this.loop) {
                    this.setValue(this.scale.domain[0]);
                    this.nextValGen = this.stepFn();
                } else {
                    this.stopPlaying();
                }
            } else {
                this.setValue(nxt.value);
            }
        }
    }),
    updateTrailStart: action('update trail start', function() {
        this.trail.data.filter.markers.forEach((payload, key) => {
            const start = this.config.trail.starts[key];
            if (this.value < start)
                this.config.trail.starts[key] = this.value;
        });
    }),
    get frameMap() {
        //trace();
        // loading
        if (this.trail.show)
            return this.trailedFrameMap;
        else
            return this.frameMapCache;
    },
    get currentFrame() {
        //trace();
        const map = this.marker.filteredOrderedDataMap;
        if (map.has(this.frameKey)) {
            return map.get(this.frameKey);
        } else {
            console.warn("Frame value not found in frame map", this)
            return new Map();
        }
    },
    get prop() {
        return this.marker.getPropForEncoding(this);
    },
    get frameKey() {
        return createMarkerKey({ [this.prop]: this.value });
    },
    get rowKey() {
        // remove frame concept from key if it's in there
        // e.g. <geo,year>,pop => frame over year => <year>-><geo>,year,pop 
        return relativeComplement([this.data.concept], this.data.space);
    },
    get frameMapCache() {
        let result = this.marker.dataMapCache;
        const concept = this.data.concept;
        const prop = this.prop;

        if (this.interpolate) {
            result = result
                .group(this.rowKey, [this.prop])
                .reindex(this.stepFn) // reindex also orders (needed for interpolation)
                .each((group, groupKey) => { 
                    // fill result key nulls after reindex
                    const fillFns = {};
                    result.key.forEach(dim => {
                        if (dim in groupKey)
                            fillFns[dim] = groupKey[dim];
                        if (dim == concept)
                            fillFns[dim] = row => row[prop]; 
                    })
                    group.fillNull(fillFns)
                })
                .interpolate() // fill rest of nulls through interpolation
                .flatten();
        }

        result = result.group(this.prop, this.rowKey);

        const orderEnc = this.marker.encoding.get("order");
        if (orderEnc)
            orderEnc.order(result);

        return result;
    },
    // basically transpose and filter framemap
    get trailedFrameMap() {
        trace();
        const frameMap = this.frameMapCache;
        const markers = this.trail.data.filter.markers;

        if (markers.size == 0)
            return frameMap;

        // create trails
        const trails = new Map();
        for (let key of markers.keys()) {
            const trail = new Map();
            trails.set(key, trail);
            for (let [i, frame] of frameMap) {
                if (frame.hasByObjOrStr(null,key))
                    trail.set(i, frame.getByObjOrStr(null,key));
            }
        }


        // add trails to frames
        const prop = this.prop;
        const newFrameMap = DataFrameGroup([], [prop], this.rowKey);
        for (let [id, frame] of frameMap) {
            const newFrame = DataFrame([], frame.key);
            for (let [markerKey, markerData] of frame) {
                // insert trails before its head marker
                if (trails.has(markerKey)) {
                    const trail = trails.get(markerKey);
                    const trailStart = this.trail.starts[markerKey];
                    const trailEnd = markerData[prop];
                    // add trail markers in ascending order
                    for (let i of this.stepFn(trailStart, trailEnd)) {
                        if (equals(i, trailEnd)) break; // skip last trail bubble (= actual marker)
                        const trailMarker = trail.get(createMarkerKey({ [prop]: i })); 
                        const newKey = markerKey + '-' + prop + '-' + i;
                        const newData = Object.assign({}, trailMarker, {
                            [Symbol.for('key')]: newKey,
                            [Symbol.for('trailHeadKey')]: markerKey
                        });
                        newFrame.setByKeyStr(newKey, newData);
                    }
                }
                // (head) marker
                newFrame.setByKeyStr(markerKey, markerData);
            }
            newFrameMap.set(id, newFrame);
        }
        return newFrameMap;
    },
    setUpReactions() {
        // need reaction for timer as it has to set frame value
        // not allowed to call action (which changes state) from inside observable/computed, thus reaction needed
        const controlTimer = reaction(
            // mention all observables (state & computed) which you want to be tracked
            // if not tracked, they will always be recomputed, their values are not cached
            () => { return { playing: this.playing, speed: this.speed } },
            ({ playing, speed }) => {
                clearInterval(this.playInterval);
                if (playing) {
                    this.nextValGen = this.stepFn(this.value);
                    this.update();
                    this.playInterval = setInterval(this.update.bind(this), speed);
                }
            }, 
            { name: "frame" }
        );
    }
}

export function frame(config) {
    applyDefaults(config, defaultConfig);
    return assign(baseEncoding(config), functions);
}