import { baseEncoding } from './baseEncoding';
import { action, reaction, trace } from 'mobx'
import { FULFILLED } from 'mobx-utils'
import { assign, applyDefaults, relativeComplement, configValue, parseConfigValue, ucFirst, stepGeneratorFunction } from '../utils';
import { DataFrameGroupMap } from '../../dataframe/dataFrameGroup';
import { createMarkerKey, parseMarkerKey } from '../../dataframe/utils';
import { DataFrame } from '../../dataframe/dataFrame';
//import { interpolate, extent } from 'd3';

const defaultConfig = {
    modelType: "frame",
    value: null,
    loop: false,
    scale: { modelType: "frame" },
}

const defaults = {
    interpolate: true,
    loop: false,
    speed: 100,
    step: { unit: "step", size: 1 }
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
    get interpolate() { return this.config.interpolate || defaults.interpolate },
    get step() { return this.stepScale.invert(this.value); },
    get stepSize() { return this.config.step && this.config.step.size || defaults.step.size },
    get stepUnit() { return this.config.step && this.config.step.unit || this.autoStepUnit() },
    autoStepUnit() {
        if (this.data.state !== "fulfilled")
            return defaults.step.unit; // no concept information yet

        const { concept, concept_type } = this.data.conceptProps;
        if (concept_type == 'measure') 
            return 'number';

        if (['string','entity_domain','entity_set'].includes(concept_type)) 
            return 'step';

        if (concept_type == 'time') {
            if (['year', 'month','day','hour','minute','second'].includes(concept)) {
                return concept;
            }
            if (concept == "time")
                return "year";
        }
        return defaults.step.unit;
    },
    get framesAround() {
        return [Math.floor(this.step), Math.ceil(this.step)].map(this.stepScale);
    },
    get count() {        
        const intervalName = 'utc' + ucFirst(this.stepUnit);
        let diff;
        if (d3[intervalName]) 
            diff = Math.floor(d3[intervalName].count(this.scale.domain[0], this.scale.domain[1]) / this.stepSize);
        else
            diff = (end - start) / this.stepSize;
        return diff + 1;
    },
    get stepScale() {
        return d3.scaleLinear([0, this.count - 1], this.scale.domain);
    },
    get speed() { return this.config.speed || defaults.speed },
    get loop() { return this.config.loop || defaults.loop },
    playing: false,
    togglePlaying() {
        this.playing ?
            this.stopPlaying() :
            this.startPlaying();
    },
    startPlaying: action('startPlaying', function() {
        if (this.step >= this.stepCount)
            this.setStep(0);

        this.setPlaying(true);
    }),
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
        let parsed = parseConfigValue(value, concept);
        if (parsed != null) {
            parsed = this.scale.clampToDomain(parsed);
        }
        this.config.value = configValue(parsed, concept);
    }),
    setStep: action('setStep', function(step) {
        this.setValue(this.stepScale(step));
    }),
    setValueAndStop: action('setValueAndStop', function(value) {
        this.stopPlaying();
        this.setValue(value);
    }),
    setStepAndStop: action('setStepAndStop', function(step) {
        this.stopPlaying();
        this.setStep(step);
    }),
    snap: action('snap', function () {
        this.setStep(Math.round(this.step));
    }),
    nextStep: action('update to next frame value', function() {
        if (this.playing && this.marker.state === FULFILLED) {
            let nxt = this.step + 1;
            if (nxt < this.stepCount) {
                this.setStep(nxt);
            } else {
                if (this.loop) {
                    this.setStep(0);          
                } else {
                    this.stopPlaying();
                }
            }
        }
    }),
    get transformationFns() {
        return {
            'frameMap': this.frameMap.bind(this),
            'currentFrame': this.currentFrame.bind(this)
        }
    },

    // FRAMEMAP TRANSFORM
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
        const stepGenerator = stepGeneratorFunction(this.stepUnit, this.stepSize, domain);

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
                    .reindex(stepGenerator)   // reindex also orders (needed for interpolation)
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
        const before = this.getFrameByStep(Math.floor(step), df);
        const after = this.getFrameByStep(Math.ceil(step), df);
        return before.interpolateTowards(after, step % 1);
    },
    getFrameByStep(step, data = this.frameMap) {
        const keys = Array.from(data.keys());
        return data.get(keys[step]);
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