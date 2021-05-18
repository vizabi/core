import { baseEncoding } from './baseEncoding';
import { action, observable, reaction, trace } from 'mobx'
import { FULFILLED } from 'mobx-utils'
import { assign, applyDefaults, relativeComplement, configValue, parseConfigValue, inclusiveRange, combineStates, equals, interval, deepclone, getOrCreate } from '../utils';
import { DataFrameGroup } from '../../dataframe/dataFrameGroup';
import { createKeyFn, pick } from '../../dataframe/dfutils';
import { configSolver } from '../dataConfig/configSolver';
import { DataFrame } from '../../dataframe/dataFrame';
import { resolveRef } from '../config';
import { evaluateGap, newGap } from '../../dataframe/transforms/interpolate';

const defaultConfig = {
    modelType: "frame",
    value: null,
    loop: false,
    data: {
        concept: {
            selectMethod: "selectFrameConcept"
        }
    },
    scale: {
        clampToData: true
    }
}

const defaults = {
    interpolate: true,
    loop: false,
    playbackSteps: 1,
    speed: 100,
    splash: false
}

export function frame(...args) {
    const obs = observable(frame.nonObservable(...args));
    obs.onCreate();
    return obs;
}

frame.nonObservable = function(config, parent) {
    applyDefaults(config, defaultConfig);

    const functions = {
        get value() {
            let value;
    
            if (this.config.value != null) {
                value = this.parseValue(this.config.value);
                value = this.scale.clampToDomain(value);
            } else {
                value = this.scale.domain[0];
            }
            return value;
        },
        parseValue(value){
            return parseConfigValue(value, this.data.conceptProps);
        },
        formatValue(value){
            return configValue(value, this.data.conceptProps);
        },
        get step() { return this.stepScale(this.value); },
        
        /**
         * Scale with frame values (e.g. years) as domain and step number (e.g. 0-15) as range.
         * Can't use 2 point linear scale as time is not completely linear (leap year/second etc)
         * @returns D3 scale
         */
        get stepScale() {
            const range = d3.range(0, this.stepCount);
            const scale = this.scale.d3Type(this.domainValues, range); 
    
            // fake clamped invert for ordinal scale
            // https://github.com/d3/d3/issues/3022#issuecomment-260254895
            if (!scale.invert) scale.invert = step => this.domainValues[step];
    
            return scale;
        },
        /**
         * Key frame values limited to scale domain
         **/ 
        get domainValues() {
            let frameValues = [];
            // default domain data is after filtering, so empty frames are dropped, so steps doesn't include those
            for (let frame of this.data.domainData.values()) {
                const frameValue = frame.values().next().value[this.name];
                if (this.scale.domainIncludes(frameValue)) {
                    frameValues.push(frameValue);
                } 
            }
            return frameValues
        },
        get stepCount() {
            return this.domainValues.length;
        },
    
        // PLAYBACK
        get speed() { 
            if (this.immediate) return 0;
            return this.config.speed || defaults.speed 
        },
        get loop() { return this.config.loop || defaults.loop },
        get playbackSteps() { return this.config.playbackSteps || defaults.playbackSteps },
        immediate: false,
        playing: false,
        togglePlaying() {
            this.playing ?
                this.stopPlaying() :
                this.startPlaying();
        },
        startPlaying: action('startPlaying', function startPlaying() {
            this.setPlaying(true);
        }),
        stopPlaying: action('stopPlaying', function stopPlaying() {
            this.setPlaying(false);
        }),
        jumpToFirstFrame: action('jumpToFirstFrame', function jumpToFirstFrame() {
            this.setStep(0);
            this.immediate = this.playing;
        }),
        setPlaying: action('setPlaying', function setPlaying(playing) {
            this.playing = playing;
            if (playing) {
                if (this.step == this.stepCount - 1) {
                    this.jumpToFirstFrame();
                } else {
                    this.nextStep()
                }
            }
        }),
        setSpeed: action('setSpeed', function setSpeed(speed) {
            speed = Math.max(0, speed);
            this.config.speed = speed;
        }),
        setValue: action('setValue', function setValue(value) {
            let concept = this.data.conceptProps;
            let parsed = this.parseValue(value);
            if (parsed != null) {
                parsed = this.scale.clampToDomain(parsed);
            }
            this.config.value = configValue(parsed, concept);
        }),
        setStep: action('setStep', function setStep(step) {
            this.setValue(this.stepScale.invert(step));
        }),
        setValueAndStop: action('setValueAndStop', function setValueAndStop(value) {
            this.stopPlaying();
            this.setValue(value);
        }),
        setStepAndStop: action('setStepAndStop', function setStepAndStop(step) {
            this.stopPlaying();
            this.setStep(step);
        }),
        snap: action('snap', function snap() {
            this.setStep(Math.round(this.step));
        }),
        ceilKeyFrame() {
            return this.stepScale.invert(Math.ceil(this.step));
        },
        nextStep: action('update to next frame value', function nextStep() {
            if (this.playing && this.marker.state === FULFILLED) {
                this.immediate = false;
                let nxt = this.step + this.playbackSteps;
                if (nxt < this.stepCount) {
                    this.setStep(nxt);
                } else if (this.step == this.stepCount - 1) {
                    // on last frame
                    if (this.loop) {
                        this.jumpToFirstFrame();
                    } else {
                        this.stopPlaying();
                    }
                } else {
                    // not yet on last frame, go there first
                    this.setStep(this.stepCount - 1); 
                }
            }
        }),
    
        /**
         * Given an array of normalized marker-key strings, gives the extent/domain of each in the frameMap
         * @param {[string]} markerKeys
         * @returns 
         */
        markerLimits(markerKeys) {
            const frameMap = this.dataMapBeforeTransform("currentFrame");
            return frameMap.extentOfGroupKeyPerMarker(markerKeys)
        },
    
        // TRANSFORMS
        get transformationFns() {
            return {
                'frameMap': this.frameMap.bind(this),
                'currentFrame': this.currentFrame.bind(this)
            }
        },
    
        // FRAMEMAP TRANSFORM
        get interpolate() { return this.config.interpolate || defaults.interpolate },
        frameMap(df) {
            df = df.groupBy(this.name, this.rowKeyDims);
            if (df.size > 0 && this.interpolate) 
                df = this.interpolateData(df);
            
            return df;
        },
        get interpolationEncodings() {
            const enc = this.marker.encoding;
            const encProps = Object.keys(enc).filter(prop => enc[prop] != this);
            if (!this.data.conceptInSpace)
                return encProps;
            else
                return encProps.filter(prop => {
                    return enc[prop].data.space && enc[prop].data.space.includes(this.data.concept);
                })
        },
        interpolateData(frameMap) {
            const concept = this.data.concept;
            const name = this.name;
            //console.time('int step');

            // reindex framemap - add missing frames within domain
            // i.e. not a single defining encoding had data for these frame
            // reindexing also sorts frames
            const domain = frameMap.keyExtent();
            const newIndex = inclusiveRange(domain[0], domain[1], concept);
            const newFrameMap = frameMap.reindexMembers(newIndex);
  
            // what fields to interpolate?
            const fields = newFrameMap.values().next().value.fields;
            const interpolateFields = this.interpolationEncodings;
            const constantFields = relativeComplement(interpolateFields, fields);
            const emptyRow = createEmptyRow(fields);

            //console.log('reindexed')
            //console.timeLog('int step');

            // Gapfilling/Reindexing markers: add missing marker rows between first and last sighting
            /**
             * MISSING MARKER METHOD
             * Keeps a list of all markers it has seen in previous frames, and if they have been missing in frames up until current
             * For each frame:
             * 1. Adds new markers to list of seen markers
             * 2. If frame contains less markers than all markers it's seen:
             *   a. check if any of the seen markers are not in frame, if so add this row to missing frames for that marker
             *   b. if a marker is in frame, and it has been missing in frames before, we found a gap we can fill 
             * 
             * Seems less more variable run time, possibly more GC?
             * Checks all markers that were ever active, even if there won't be any more appearances.
             * Shorter!
             *
            const markers = new Map();
            const newMarkers = new Set();
            for (const frameKey of newFrameMap.keys()) {
                const frame = newFrameMap.get(frameKey);
                newMarkers.clear();
                for (const key of frame.keys()) {
                    const row = frame.get(key);
                    if (!markers.has(key)) {
                        let newRow = Object.assign(emptyRow, pick(row, constantFields));
                        newRow[Symbol.for('key')] = key;
                        newMarkers.add(key);
                        markers.set(key, [ newRow, [] ]);
                    }
                }

                // don't need to fill missing markers if frame contains them all
                if (markers.size != frame.size) {
                    // use old markers, no need to check markers that were just added
                    for (const key of markers.keys()) {
                        const [ newRow, missingFromFrame ] = markers.get(key);
                        if (newMarkers.has(key)) continue;
                        if (!frame.has(key)) {
                            missingFromFrame.push(frame);
                        } 
                        else if (missingFromFrame.length > 1) {
                            for (const missingFrameKey of missingFromFrame) {
                                const row = Object.assign( // deepmerge to copy Date objects
                                    {}, newRow, newFrameMap.keyObject(frame)
                                );
                                row[this.data.concept] = row[name];
                                frame.setByStr(key, row) 
                            }
                            missingFromFrame.length = 0;
                        }
                    }
                }
            }
            /**/
            
            /* 
             * EXTENT METHOD
             * 1. gets frame-extent for each marker, 
             * 2. Transforms frame extent to marker enter & exits per frame
             * 3. Goes over frames and adds missing markers between enter & exit
             * 
             * This method works well for sparse frames, with many intermediate markers missing.
             * It only checks markers we know should be active.
             * It can easily skip frames if it contains all its expected markers. 
             * It takes extra preparation to do this.
             ***/

            // 1. get a list of all markers including first/last frame we see them (i.e. extent)
            const markers = new Map();
            for (const frameKey of newFrameMap.keys()) {
                const frame = newFrameMap.get(frameKey);
                for (const key of frame.keys()) {
                    const row = frame.getByStr(key);
                    if (!markers.has(key)) {
                        let newRow = Object.assign(emptyRow, pick(row, constantFields));
                        newRow[Symbol.for('key')] = key;
                        markers.set(key, { newRow, firstFrame: frameKey, lastFrame: frameKey });
                    } else {
                        markers.get(key).lastFrame = frameKey;
                    }
                }
            }

            //console.log('get marker extend')
            //console.timeLog('int step');

            // 2. transform list of markers to list of frames with set of markers that enter & exit
            const enterPerFrame = new Map();
            const exitPerFrame = new Map();
            for (const [markerKey, { firstFrame, lastFrame }] of markers) {
                addToMappedSet(enterPerFrame, firstFrame, markerKey);
                addToMappedSet(exitPerFrame, lastFrame, markerKey);
            }
            function addToMappedSet(map, mapKey, payLoad) {
                const set = map.get(mapKey);
                if (!set) map.set(mapKey, new Set([payLoad]))
                else set.add(payLoad);
            }

            //console.log('get transformed marker extend ')
            //console.timeLog('int step');

            // 3. fill frames with missing markers
            const activeMarkers = new Set();
            const emptySet = new Set();
            const addToActive = activeMarkers.add.bind(activeMarkers);
            const delFromActive = activeMarkers.delete.bind(activeMarkers);
            for (const frameKey of newFrameMap.keys()) {
                const frame = newFrameMap.get(frameKey);
                const exits = exitPerFrame.get(frameKey) ?? emptySet;
                const enters = enterPerFrame.get(frameKey) ?? emptySet;
                // skip if all active markers are already in the frame
                if (frame.size == activeMarkers.size + enters.size) {
                    enters.forEach(addToActive);
                    continue;
                }
                // already remove exits, we know they're in this frame
                exits.forEach(delFromActive);
                const missingMarkers = relativeComplement(frame, activeMarkers);
                for (const key of missingMarkers) {
                    const row = deepclone( // deepclone to copy Date objects
                        Object.assign({}, markers.get(key).newRow, newFrameMap.keyObject(frame))
                    );
                    row[this.data.concept] = row[name]
                    frame.setByStr(key, row) 
                }
                // only now add enters, we already knew they're in this frame
                enters.forEach(addToActive);
            }
            //console.log('add markers')
            //console.timeLog('int step');
            /**/

            // with all markers in place, actually interpolate
            //console.time('interpolate');
            const markersArray = Array.from(markers.keys());
            for (const field of interpolateFields) {
                const gapPerMarker = new Map(markersArray.map(key => [key, newGap()]));
                for (const frame of newFrameMap.values()) {                    
                    for (const markerKey of frame.keys()) {
                        const row = frame.getByStr(markerKey); // less gc: not creating arrays which are destructured in for loop
                        const gap = gapPerMarker.get(markerKey);
                        evaluateGap(row, field, gap)
                    }
                }
                //console.log('finished interpolating field', field);
                //console.timeLog('interpolate');
            }

            //console.timeEnd('interpolate');
            //console.log('interpolate')
            //console.timeEnd('int step');

            return newFrameMap;

            function createEmptyRow(fields) {
                const obj = {};
                for (let field of fields) obj[field] = undefined;
                return obj;
            }

        },
        get rowKeyDims() {
            // remove frame concept from key if it's in there
            // e.g. <geo,year>,pop => frame over year => <year>-><geo>,year,pop 
            return relativeComplement([this.data.concept], this.data.space);
        },
    
        // CURRENTFRAME TRANSFORM
        currentFrame(data) {
            if (data.size == 0) 
                return DataFrame([], data.descendantKeys[0]);
    
            return data.has(this.frameKey) 
                ? data.get(this.frameKey)
                : this.scale.domainIncludes(this.value, this.data.domain)
                    ? this.getInterpolatedFrame(data, this.step, this.stepsAround)
                    : DataFrame([], data.descendantKeys[0]);
    
        },
        get frameKey() {
            return createKeyFn([this.name])({ [this.name]: this.value }) // ({ [this.name]: this.value });
        },
        getInterpolatedFrame(df, step, stepsAround) {
            const keys = Array.from(df.keys());
            const [before, after] = stepsAround.map(step => df.get(keys[step]));
            return before.interpolateTowards(after, step % 1);
        },
        get stepsAround() {
            return [Math.floor(this.step), Math.ceil(this.step)];
        },
        get framesAround() {
            return this.stepsAround.map(this.stepScale.invert);
        },
    
        /*
         * Compute the differential (stepwise differences) for the given field 
         * and return it as a new dataframe(group).
         * NOTE: this requires that the given df is interpolated.
         * USAGE: set a correct list of transformations on the __marker__
         * and then add/remove the string "differentiate" to the data of an 
         * encoding in that marker. For example:
         *   markers: {
         *      marker_destination: {
         *        encoding: {
         *           "x": {
         *             data: {
         *               concept: "displaced_population",
         *               transformations: ["differentiate"]
         *             }
         *           },
         *          ...
         *        },
         *        transformations: [
         *          "frame.frameMap",
         *          "x.differentiate",
         *          "filterRequired",
         *          "order.order",
         *          "trail.addTrails",
         *          "frame.currentFrame"
         *        ]
         * 
         */
        differentiate(df, xField) {
            let prevFrame;
            let result = DataFrameGroup([], df.key, df.descendantKeys);
            for (let [yKey, frame] of df) {
                const newFrame = frame.copy()
                for(let [key, row] of newFrame) {
                    const newRow = Object.assign({}, row);
                    const xValue = row[xField];
                    if (xValue !== undefined) {
                        newRow[xField] = prevFrame ? xValue - prevFrame.getByStr(key)[xField] : 0;
                    }
                    newFrame.set(newRow, key);
                }
                prevFrame = frame;
                result.set(yKey, newFrame);
            }
            return result;
        },
        get state() {
            const states = [this.data.state, this.data.source.conceptsPromise.state];
            return combineStates(states);
        },
        onCreate() {
            // need reaction for timer as it has to set frame value
            // not allowed to call action (which changes state) from inside observable/computed, thus reaction needed
            const playbackDestruct = reaction(
                // mention all observables (state & computed) which you want to be tracked
                // if not tracked, they will always be recomputed, their values are not cached
                () => { return { playing: this.playing, speed: this.speed } },
                ({ playing, speed }) => {
                    clearInterval(this.playInterval);
                    if (playing) {
                        this.playInterval = setInterval(this.nextStep.bind(this), speed);
                    }
                }, 
                { name: "frame playback timer" }
            );
            this.destructers.push(playbackDestruct);
            const configLoopbackDestruct = reaction(
                () => { 
                    const waitFor = this.marker || this;
                    if (waitFor.state == 'fulfilled') return this.value 
                },
                (value) => {
                    if (value && "value" in this.config && !equals(this.config.value, value)) {
                        this.config.value = configValue(value, this.data.conceptProps);
                    }
                },
                { name: "frame config loopback" }
            );
            this.destructers.push(configLoopbackDestruct);
            this.destructers.push(() => {
                clearInterval(this.playInterval);
            })
        },
        get splash() { 
            return this.config.splash || defaults.splash;
        }
    }

    return assign(baseEncoding.nonObservable(config, parent), functions);
}

frame.splashMarker = function splashMarker(marker) {
    const frame = marker.encoding.frame;
    if (frame?.splash) {
        const concept = resolveRef(frame.config.data.concept);
        if (typeof concept == "string") {
            let splashConfig = Vizabi.utils.deepclone(marker.config);
            const filterMerge = { data: { filter: { dimensions: { [concept]: { [concept]: 
                frame.config.value 
            } } } } }
            splashConfig = Vizabi.utils.deepmerge(splashConfig, filterMerge);
            
            let splashMarker = Vizabi.marker(splashConfig, marker.id + '-splash');
            let proxiedMarker = markerWithFallback(marker, splashMarker);

            return { marker: proxiedMarker, splashMarker }
        } else {
            console.warn("Frame splash does not work with autoconfig concept. Please set frame.data.concept or disable splash.")
            return { marker };
        }
    } else {
        return { marker };
    }
}

function markerWithFallback(marker, fallback) {
    return new Proxy(marker, {
        get: function(target, prop, receiver) {

            if (fallback && target.state == 'fulfilled') {
                fallback.dispose();
                fallback = undefined;
            }

            return fallback
                ? fallback[prop]
                : target[prop];
        }
    })
}

configSolver.addSolveMethod(
    function selectFrameConcept({ concepts, space, dataConfig }) {
        const spaceConcepts = space.map(dim => dataConfig.source.getConcept(dim));
        return findTimeOrMeasure(spaceConcepts) || findTimeOrMeasure(concepts) || spaceConcepts[spaceConcepts.length - 1];
        
        function findTimeOrMeasure (concepts) {
            return concepts.find(c => c.concept_type == 'time') || concepts.find(c => c.concept_type == 'measure');
        }
    }
)