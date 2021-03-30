import { baseEncoding } from './baseEncoding';
import { action, reaction, trace } from 'mobx'
import { FULFILLED } from 'mobx-utils'
import { assign, applyDefaults, relativeComplement, configValue, parseConfigValue, ucFirst, stepGeneratorFunction, inclusiveRange, combineStates } from '../utils';
import { DataFrameGroupMap } from '../../dataframe/dataFrameGroup';
import { createMarkerKey, parseMarkerKey } from '../../dataframe/dfutils';
import { configSolver } from '../dataConfig/configSolver';

const defaultConfig = {
    modelType: "frame",
    value: null,
    loop: false,
    data: {
        concept: {
            selectMethod: "selectFrameConcept"
        }
    }
}

const defaults = {
    interpolate: true,
    loop: false,
    playbackSteps: 1,
    speed: 100
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
    get step() { return this.stepScale.invert(this.value); },
    
    /**
     * Scale with frame values (e.g. years) as domain and step number (e.g. 0-15) as range.
     * @returns D3 scale
     */
    // this scale uses binary search to find which subsection of scale to work on. Could be optimized
    // using knowledge frames are equidistant. Using e.g. time interval offset.
    // can't use 2 point linear scale as time is not completely linear (leap year/second etc)
    get stepScale() {
        // default domain data is after filtering, so empty frames are dropped, so steps doesn't include those
        const domainData = this.data.domainData; 
        const frameValues = [];
        domainData.each(group => frameValues.push(group.values().next().value[this.name]));
        // use (possible) dates in range so no need for separate utcScale on time concepts
        return d3.scaleLinear(d3.range(0, this.stepCount), frameValues); 
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
    parse(value){
        return parseConfigValue(value, this.data.conceptProps);
    },
    setValue: action('setValue', function setValue(value) {
        const concept = this.data.conceptProps;
        let parsed = parseConfigValue(value, concept);
        if (parsed != null) {
            parsed = this.scale.clampToDomain(parsed);
        }
        this.config.value = configValue(parsed, concept);
    }),
    setStep: action('setStep', function setStep(step) {
        this.setValue(this.stepScale(step));
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
        // filterRequired, which needs data to be interpolated (and might have less frames)
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
                    .interpolate();    // fill rest of nulls through interpolation
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
            this.getInterpolatedFrame(data, this.step, this.stepsAround);
        // else {
        //     console.warn("Frame value not found in frame map", this)
        //     return new Map();
        // }

    },
    get frameKey() {
        return createMarkerKey({ [this.name]: this.value });
    },
    getInterpolatedFrame(df, step, stepsAround) {
        if (!df.size) return;
        const keys = Array.from(df.keys());
        const [before, after] = stepsAround.map(step => df.get(keys[step]));
        return before.interpolateTowards(after, step % 1);
    },
    get stepsAround() {
        return [Math.floor(this.step), Math.ceil(this.step)];
    },
    get framesAround() {
        return this.stepsAround.map(this.stepScale);
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
    get state() {
        const states = [this.data.state, this.data.source.conceptsPromise.state];
        return combineStates(states);
    },
    onCreate() {
        // need reaction for timer as it has to set frame value
        // not allowed to call action (which changes state) from inside observable/computed, thus reaction needed
        const destruct = reaction(
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
        this.destructers.push(destruct);
        this.destructers.push(() => {
            clearInterval(this.playInterval);
        })
    }
}

export function frame(...args) {
    const obs = observable(frame.nonObservable(...args));
    obs.setUpReactions();
    return obs;
}

frame.nonObservable = function(config, parent) {
    applyDefaults(config, defaultConfig);

    configSolver.addSelectMethod(
        function selectFrameConcept({ concepts, space }) {
            const spaceConcepts = concepts.filter(c => space.includes(c.concept));
            return findTimeOrMeasure(spaceConcepts) || findTimeOrMeasure(concepts) || spaceConcepts[spaceConcepts.length - 1];
            
            function findTimeOrMeasure (concepts) {
                return concepts.find(c => c.concept_type == 'time') || concepts.find(c => c.concept_type == 'measure');
            }
        }
    )
    return assign(baseEncoding.nonObservable(config, parent), functions);
}