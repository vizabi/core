import { baseEncoding } from './baseEncoding';
import { action, reaction, trace } from 'mobx'
import { FULFILLED } from 'mobx-utils'
import { assign, applyDefaults, relativeComplement, configValue, parseConfigValue, ucFirst, stepGeneratorFunction, inclusiveRange } from '../utils';
import { DataFrameGroupMap } from '../../dataframe/dataFrameGroup';
import { createMarkerKey, parseMarkerKey } from '../../dataframe/utils';

const defaultConfig = {
    modelType: "frame",
    value: null,
    loop: false
}

const defaults = {
    interpolate: true,
    loop: false,
    playbackSteps: 1,
    speed: 100
}

const functions = {
    get value() {
        trace();
        let value;

        if (this.config.value != null) {
            value = parseConfigValue(this.config.value, this.data.conceptProps);
            value = this.scale.clampToDomain(value);
        } else {
            value = this.scale.domain[0];
        }
        return value;
    },
    get step() { return this.stepScale(this.value); },
    
    /**
     * Scale with frame values (e.g. years) as domain and step number (e.g. 0-15) as range.
     * @returns D3 scale
     */
    // this scale uses binary search to find which subsection of scale to work on. Could be optimized
    // using knowledge frames are equidistant. Using e.g. time interval offset.
    // can't use 2 point linear scale as time is not completely linear (leap year/second etc)
    get stepScale() {
        const domainData = this.data.domainData;
        const frameValues = [];
        domainData.each(group => frameValues.push(group.values().next().value[this.name]));
        if (this.value instanceof Date)
            return d3.scaleUtc(frameValues, d3.range(0, this.stepCount));
        return d3.scaleLinear(frameValues, d3.range(0, this.stepCount));
    },
    get stepCount() {
        return this.data.domainData.size
    },

    // PLAYBACK
    get speed() { return this.config.speed || defaults.speed },
    get loop() { return this.config.loop || defaults.loop },
    get playbackSteps() { return this.config.playbackSteps || defaults.playbackSteps },
    playing: false,
    togglePlaying() {
        this.playing ?
            this.stopPlaying() :
            this.startPlaying();
    },
    startPlaying: action('startPlaying', function startPlaying() {
        if (this.step >= this.stepCount - 1)
            this.setStep(0);

        this.setPlaying(true);
    }),
    stopPlaying: function() {
        this.setPlaying(false);
    },
    setPlaying: action('setPlaying', function setPlaying(playing) {
        this.playing = playing;
    }),
    setSpeed: action('setSpeed', function setSpeed(speed) {
        speed = Math.max(0, speed);
        this.config.speed = speed;
    }),
    setValue: action('setValue', function setValue(value) {
        const concept = this.data.conceptProps;
        let parsed = parseConfigValue(value, concept);
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
    nextStep: action('update to next frame value', function nextStep() {
        if (this.playing && this.marker.state === FULFILLED) {
            let nxt = this.step + this.playbackSteps;
            if (nxt < this.stepCount) {
                this.setStep(nxt);
            } else if (this.step == this.stepCount - 1) {
                // on last frame
                if (this.loop) {
                    this.setStep(0);          
                } else {
                    this.stopPlaying();
                }
            } else {
                // not yet on last frame, go there first
                this.setStep(this.stepCount - 1); 
            }
        }
    }),

    // TRANSFORMS
    get transformationFns() {
        return {
            'frameMap': this.frameMap.bind(this),
            'currentFrame': this.currentFrame.bind(this)
        }
    },

    // FRAMEMAP TRANSFORM
    get interpolate() { return this.config.interpolate || defaults.interpolate },
    frameMap(data) {
        if (this.interpolate) 
            data = this.interpolateData(data);
        return data.groupBy(this.name, this.rowKeyDims);
    },
    interpolateData(df) {
        const concept = this.data.concept;
        const name = this.name;
        // can't use scale.domain as it is calculated after 
        // filterRequired, which needs data to be interpolated
        const domain = this.data.calcDomain(df, this.data.conceptProps);
        const newIndex = inclusiveRange(domain[0], domain[1], concept);

        return df
            .groupBy(this.rowKeyDims, [name])
            .map((group, groupKeyDims) => { 

                const fillFns = {};
                df.key.forEach(dim => {
                    // copy space values from group key
                    if (dim in groupKeyDims) 
                        fillFns[dim] = groupKeyDims[dim];
                    // frame concept not in group key so copy from row
                    if (dim === concept)
                        fillFns[dim] = row => row[name];  
                })

                return group
                    .reindex(newIndex) // reindex also orders (needed for interpolation)
                    .fillNull(fillFns) // fill nulls of marker space with custom fns
                    .interpolate()    // fill rest of nulls through interpolation
            })
            .flatten(df.key);
    },
    get rowKeyDims() {
        // remove frame concept from key if it's in there
        // e.g. <geo,year>,pop => frame over year => <year>-><geo>,year,pop 
        return relativeComplement([this.data.concept], this.data.space);
    },

    // CURRENTFRAME TRANSFORM
    currentFrame(data) {
        return data.has(this.frameKey) ? 
            data.get(this.frameKey)
            :
            this.getInterpolatedFrame(data, this.step);
        // else {
        //     console.warn("Frame value not found in frame map", this)
        //     return new Map();
        // }

    },
    get frameKey() {
        return createMarkerKey({ [this.name]: this.value });
    },
    getInterpolatedFrame(df, step) {
        if (!df.size) return;
        const keys = Array.from(df.keys());
        const [before, after] = this.stepsAround.map(step => df.get(keys[step]));
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
        let result = DataFrameGroupMap([], df.key, df.descendantKeys);
        for (let [yKey, frame] of df) {
            const newFrame = frame.copy()
            for(let [key, row] of newFrame) {
                const newRow = Object.assign({}, row);
                const xValue = row[xField];
                if (xValue !== undefined) {
                    newRow[xField] = prevFrame ? xValue - prevFrame.get(parseMarkerKey(key))[xField] : 0;
                }
                newFrame.set(newRow, key);
            }
            prevFrame = frame;
            result.set(yKey, newFrame);
        }
        return result;
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
                    this.nextStep();
                    this.playInterval = setInterval(this.nextStep.bind(this), speed);
                }
            }, 
            { name: "frame playback timer" }
        );
    }
}

export function frame(config) {
    applyDefaults(config, defaultConfig);
    return assign(baseEncoding(config), functions);
}