import { encoding } from './encoding';
import { action, observable, reaction, computed, trace } from 'mobx'
import { FULFILLED } from 'mobx-utils'
import { assign, applyDefaults, relativeComplement, configValue, parseConfigValue, inclusiveRange, POSSIBLE_INTERVALS, combineStates, equals, createModel, stepBeforeInterpolator } from '../utils';
import { DataFrameGroup } from '../../dataframe/dataFrameGroup';
import { createKeyFn } from '../../dataframe/dfutils';
import { configSolver } from '../dataConfig/configSolver';
import { DataFrame } from '../../dataframe/dataFrame';
import { resolveRef } from '../config';
import {range as d3_range} from "d3";

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
        clampDomainToData: true
    }
}

const defaults = {
    interpolate: true,
    extrapolate: false,
    playEmptyFrames: false,
    loop: false,
    playbackSteps: 1,
    speed: 100,
    interval: "year",
    splash: false
}

export function frame(...args) {
    return createModel(frame, ...args);
}

frame.nonObservable = function(config, parent, id) {
    applyDefaults(config, defaultConfig);

    const functions = {
        get value() {
            let value;
    
            if (this.config.value != null) {
                value = this.parseValue(this.config.value);
                value = this.scale.clampToDomain(value);
            } else {
                value = this.scale.domain.at(-1);
            }
            return value;
        },
        parseValue(value){
            if (typeof value === "number") value = "" + value;
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
            const range = d3_range(0, this.stepCount);
            const scale = this.scale.d3Type(this.domainValues, range); 
    
            // fake clamped invert for ordinal scale
            // https://github.com/d3/d3/issues/3022#issuecomment-260254895
            if (!scale.invert) scale.invert = step => this.domainValues[step];
    
            return scale;
        },
        get playEmptyFrames() {
            return this.config.playEmptyFrames ?? defaults.playEmptyFrames;
        },
        /**
         * Key frame values limited to scale domain
         **/ 
        get domainValues() {
            const frameMap = this.marker.getTransformedDataMap("filterRequired");
            if (this.playEmptyFrames) {
                const domain = frameMap.keyExtent();
                return inclusiveRange(domain[0], domain[1], this.interval);
            } else {
                let frameValues = [];
                for (let frame of frameMap.values()) {
                    const frameValue = frame.values().next().value[this.name];
                    if (this.scale.domainIncludes(frameValue)) {
                        frameValues.push(frameValue);
                    } 
                }
                return frameValues
            }
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
        setExtrapolate: action('setExtrapolate', function setExtrapolate(extrapolate) {
            this.config.extrapolate = extrapolate;
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
                'interpolate': this.interpolateData.bind(this),
                'extrapolate': this.extrapolateData.bind(this),
                'currentFrame': this.currentFrame.bind(this)
            }
        },
        get transformFields() {
            return [this.name];
        },
    
        // FRAMEMAP TRANSFORM
        frameMap(df) {
            let frameMap = df.groupBy(this.name, this.rowKeyDims);
            // reindex framemap - add missing frames within domain
            // i.e. not a single defining encoding had data for these frame
            // reindexing also sorts frames
            return frameMap.reindexToKeyDomain(this.interval);
        },
        get rowKeyDims() {
            // remove frame concept from key if it's in there
            // e.g. <geo,year>,pop => frame over year => <year>-><geo>,year,pop 
            return relativeComplement([this.data.concept], this.data.space);
        },

        // interpolate transform
        get interpolate() { return this.config.interpolate ?? defaults.interpolate },
        interpolateData(frameMap) {
            if (frameMap.size == 0 || !this.interpolate) 
                return frameMap;

            const newFrameMap = frameMap.copy();
            const encName = this.name;

            return newFrameMap.interpolateOverMembers({ 
                fields: this.changeBetweenFramesEncodings,
                frameField: encName,
                frameCopyFields: this.encodingsThatCopyFrame.concat(this.data.concept),
                interpolators: this.fieldCustomInterpolators
            });
        },
        get encodingsThatCopyFrame() {
            const enc = this.marker.encoding;
            return Object.keys(enc).filter(prop => 
                enc[prop] != this 
                && enc[prop].data.concept === this.data.concept
                && enc[prop].data.space.includes(this.data.concept)
            );
        },
        get changeBetweenFramesEncodings() {
            const enc = this.marker.encoding;
            const encProps = Object.keys(enc).filter(prop => enc[prop] != this);
            if (!this.data.conceptInSpace)
                return encProps;
            else
                return encProps.filter(prop => {
                    return enc[prop].data.hasOwnData 
                        && enc[prop].data.space.includes(this.data.concept);
                })
        },
        get fieldCustomInterpolators() {
            const enc = this.marker.encoding;
            return this.changeBetweenFramesEncodings.reduce((result, encName) => {
                if(!["measure", "time"].includes(enc[encName].data?.conceptProps?.concept_type)
                    && !enc[encName].scale?.interpolate
                    && !enc[encName].data?.conceptProps?.interpolate){
                    //use zero order interpolation instead default d3.interpolate
                    result[encName] = stepBeforeInterpolator;
                }
                return result;
            }, {});
        },

        get interval() { 
            const interval = this.config.interval ?? this.data.conceptProps.concept;
            return POSSIBLE_INTERVALS.includes(interval) ? interval : defaults.interval;
        },

        // extrapolate transform
        get extrapolate() { return this.config.extrapolate ?? defaults.extrapolate },
        extrapolateData(frameMap) {
            if (frameMap.size == 0 || !this.extrapolate) 
                return frameMap;

            // find which indexes will be the first and last after marker.filterRequired transform
            // needed to limit extrapolation to eventual filterRequired (feature request by Ola)
            // can't extrapolate áfter filterRequired as some partially filled markers will already be filtered out
            const hasDataForRequiredEncodings = frame => {
                for (const marker of frame.values()) {
                    if (this.marker.requiredEncodings.every(enc => marker[enc] != null)) {
                        return true;
                    }
                }
                return false;
            }
            const requiredExtentIndices = frameMap.keyExtentIndices({
                filter: hasDataForRequiredEncodings
            })

            const encName = this.name;

            return frameMap.extrapolateOverMembers({ 
                fields: this.changeBetweenFramesEncodings,
                sizeLimit: this.extrapolate,
                indexLimit: requiredExtentIndices,
                ammendNewRow: row => {
                    row[this.data.concept] = row[encName];
                    this.encodingsThatCopyFrame.forEach(enc => {
                        Object.defineProperty(row, enc, {
                            value: row[encName],
                            enumerable: true,
                            configurable: true
                        })
                    })
                }
            });
        },

        // CURRENTFRAME TRANSFORM
        currentFrame(data) {
            if (data.size == 0) 
                return DataFrame([], data.descendantKeys[0]);
    
            return data.has(this.frameKey) 
                ? data.get(this.frameKey)
                : this.scale.domainIncludes(this.value, this.data.domain) && this.interpolate
                    ? this.getInterpolatedFrame(data, this.step, this.stepsAround)
                    : DataFrame([], data.descendantKeys[0]);
    
        },
        get frameKey() {
            return createKeyFn([this.name])({ [this.name]: this.value }) // ({ [this.name]: this.value });
        },
        get fieldsToInterpolate() {
            return [this.name, this.data.concept, ...this.changeBetweenFramesEncodings, ...this.encodingsThatCopyFrame];
        },
        getInterpolatedFrame(df, step, stepsAround) {
            const keys = Array.from(df.keys());
            const [before, after] = stepsAround.map(step => df.get(keys[step]));
            return before.interpolateTowards(after, step % 1, this.fieldsToInterpolate, this.fieldCustomInterpolators);
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
                { 
                    name: "frame playback timer",
                    onError: error => this.internalErrors.push(error) 
                }
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
                { 
                    name: "frame config loopback",
                    onError: error => this.internalErrors.push(error) 
                }
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

    return assign(encoding.nonObservable(config, parent, id), functions);
}

frame.splashMarker = function splashMarker(marker) {
    const frame = marker.encoding.frame;
    if (frame?.splash && frame?.config.value) {
        const concept = resolveRef(frame.config.data.concept).value;
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
frame.decorate = {
    changeBetweenFramesEncodings: computed.struct,
    encodingsThatCopyFrame: computed.struct
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

//instead of selecting an unused concept it selects a frame concept
//gives preference to concepts in space that are of type time and measure
//if there is no time or measure in space then check candidate concepts given by solveMethod
//if notheing there either, then pick the last dimension of the space
//it woud fail if space is an empty array
configSolver.addSolveMethod(
    function selectFrameConcept({ concepts, space, dataConfig }) {
        const spaceConcepts = space.map(dim => dataConfig.source.getConcept(dim));
        return findTimeOrMeasure(spaceConcepts) || findTimeOrMeasure(concepts) || spaceConcepts[spaceConcepts.length - 1];
        
        function findTimeOrMeasure (concepts) {
            return concepts.find(c => c.concept_type == 'time') || concepts.find(c => c.concept_type == 'measure');
        }
    }
)