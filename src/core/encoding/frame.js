import { baseEncoding } from './baseEncoding';
import { action, reaction, trace } from 'mobx'
import { FULFILLED } from 'mobx-utils'
import { assign, applyDefaults, relativeComplement, configValue, parseConfigValue, equals, getTimeInterval, mapToObj, stepIterator } from '../utils';
import { DataFrameGroupMap } from '../../dataframe/dataFrameGroup';
import { createMarkerKey, parseMarkerKey } from '../../dataframe/utils';
import { DataFrame } from '../../dataframe/dataFrame';
//import { interpolate, extent } from 'd3';

const defaultConfig = {
    modelType: "frame",
    value: null,
    scale: { modelType: "frame" },
}

const defaults = {
    interpolate: true,
    loop: false,
    speed: 100,
    step: { unit: "index", size: 1 }
}

const functions = {
    get value() {
        trace();
        const configValue = this.config.value;
        const configAnimationValue = this.config.animationValue;
        let value;

        if (configAnimationValue) {
            value = configAnimationValue
        } else {
            if (configValue != null) {
                value = parseConfigValue(configValue, this.data.conceptProps);
                value = this.scale.clampToDomain(value);
            } else {
                value = this.scale.domain[0];
            }
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
        if (this.data.state !== "fulfilled")
            return defaults.step.unit; // no concept information yet

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
    // get dataTransforms() {
    //     return this.marker.dataTransforms
    // },
    // setInterpolation: action('setInterpolate', function(onOrOff) {
    //     this.config.interpolate = !!onOrOff;
    // }),
    get interpolate() { return this.config.interpolate || defaults.interpolate },
    get stepFn() {
        return stepIterator(this.stepUnit, this.stepSize, this.scale.domain)
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
    setValue: action('setValue', function(value, animationFlag) {
        const concept = this.data.conceptProps;
        let date = value instanceof Date ? value : parseConfigValue(value, concept);
        if (date != null) {
            date = this.scale.clampToDomain(date);
        }
        if (animationFlag) {
            this.config.animationValue = date;
        } else { 
            if (this.config.animationValue) {
                this.config.animationValue = null
                value = this.snap(value);
            }
            const string = typeof value === "string" ? value : configValue(value, concept);
            this.config.value = string;
        }
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
        if (this.playing && this.marker.state === FULFILLED) {
            const nxt = this.nextValGen.next();
            if (nxt.done) {
                if (this.loop) {
                    this.setValue(this.scale.domain[0]);
                    this.nextValGen = this.stepFn();
                    this.nextValGen.next();
                } else {
                    this.stopPlaying();
                }
            } else {
                this.setValue(nxt.value);
            }
        }
    }),
    get transformationFns() {
        return {
            'currentFrame': this.currentFrame.bind(this),
            'frameMap': this.frameMap.bind(this)
        }
    },
    currentFrame(data) {
        return data.has(this.frameKey) ? 
            data.get(this.frameKey)
            :
            this.getInterpolatedFrame(data, this.value);
        // else {
        //     console.warn("Frame value not found in frame map", this)
        //     return new Map();
        // }

    },
    get frameKey() {
        return createMarkerKey({ [this.name]: this.value }, [this.name]);
    },
    get rowKeyDims() {
        // remove frame concept from key if it's in there
        // e.g. <geo,year>,pop => frame over year => <year>-><geo>,year,pop 
        return relativeComplement([this.data.concept], this.data.space);
    },
    frameMap(data) {
        if (this.interpolate) 
            data = this.interpolateData(data);
        return data.groupBy(this.name, this.rowKeyDims);
    },
    interpolateData(df) {
        const concept = this.data.concept;
        const name = this.name;
        const domain = this.data.calcDomain(df, this.data.conceptProps);
        const stepFn = stepIterator(this.stepUnit, this.stepSize, domain);
        // const dataTransforms = this.dataTransforms;

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
                    .reindex(stepFn)   // reindex also orders (needed for interpolation)
                    .fillNull(fillFns) // fill nulls of marker space with custom fns
                    .interpolate()    // fill rest of nulls through interpolation
                // const transforms = [...group.fields].map(f => dataTransforms[f]).filter(t => !!t);
                // if (transforms.length > 0) {
                //     return transforms.reduce((g,t) => g[t].apply(g), transformedGroup)
                // } else {
                //     return transformedGroup
                // }
            })
            .flatten(df.key);
    },
    differentiate(df, xField) {
        // const name = this.name;
        // let differentiated = df.groupBy(this.rowKeyDims, [name]);
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
        //         return group.differentiate(xField);
        //     });
        // differentiated = differentiated.flatten(df.key)
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
                    this.nextValGen.next();
                    this.update();
                    this.playInterval = setInterval(this.update.bind(this), speed);
                }
            }, 
            { name: "frame playback timer" }
        );
    },
    getInterpolatedFrame(data, value) {
        const steps = this.stepsAround(value);
        const stepsDf = steps.map(s => {
            const key = createMarkerKey({ [this.name]: s }, [this.name]);
            return data.get(key);
        });
        const fields = [...stepsDf[0].fields]
            .filter(f => !(f == this.data.concept || data.key.includes(f) || data.descendantKeys.flat().includes(f)));

        const name = this.name;
        const keyFields = {
            [name]: value,
            [this.data.concept]: row => row[name]
        }
        
        return this.interpolateBetweenDf(
            ...stepsDf,
            keyFields,
            fields,
            this.fraction(value, steps))
    },
    stepsAround(value) {
        const stepArray = this.stepArray;
        const index = d3.bisectLeft(stepArray, value);
        const indexStep = stepArray[index];
        return equals(value, indexStep) ?
            [indexStep]
            :
            [stepArray[index - 1] || indexStep, indexStep];
    },
    fraction(value, steps) {
        return (value - steps[0]) / (steps[1] - steps[0]);
    },
    snap(value) {
        const steps = this.stepsAround(value);
        return steps.length == 1 ? steps[0] : steps[Math.round(this.fraction(value, steps))];
    },
    interpolateBetweenDf(df1, df2, keyFieldsFillFns, fields, fraction) {
        const df = DataFrame([], df1.key);
        let newRow, row2;
        for(const [key, row1] of df1) {
            row2 = df2.getByObjOrStr(undefined, key);
            if (!row2) continue;
            newRow = Object.assign({}, row1);
            for (let field of fields) {
                newRow[field] = d3.interpolate(row1[field], row2[field])(fraction);
            }
            for (let concept in keyFieldsFillFns) {
                const fillValue = keyFieldsFillFns[concept];
                newRow[concept] = typeof fillValue == "function" ? fillValue(newRow) : fillValue;
            }
            df.setRow(newRow);
        }
        return df;
    },
}

export function frame(config) {
    applyDefaults(config, defaultConfig);
    return assign(baseEncoding(config), functions);
}