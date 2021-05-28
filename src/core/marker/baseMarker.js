import { trace, reaction, computed, observable, toJS } from 'mobx';
import { dataSourceStore } from '../dataSource/dataSourceStore'
import { dataConfigStore } from '../dataConfig/dataConfigStore'
import { assign, applyDefaults, isProperSubset, combineStates, relativeComplement, isString } from "../utils";
import { configurable } from '../configurable';
import { fullJoin } from '../../dataframe/transforms/fulljoin';
import { DataFrame } from '../../dataframe/dataFrame';
import { resolveRef } from '../config';
import { configSolver } from '../dataConfig/configSolver';
import { encodingCache } from './encodingCache';
import { createKeyFn } from '../../dataframe/dfutils';


const defaultConfig = {
    data: { },
    encoding: {},
};

const defaults = {
    requiredEncodings: [],
    transformations: [
        "aggregate.aggregate",
        "frame.frameMap",
        "frame.interpolate",
        "frame.extrapolate",
        "filterRequired", // after framemap so doesn't remove interpolatable rows
        "trail.addPreviousTrailHeads", // before ordering so trailheads get ordered
        "order.order", 
        "trail.addTrails", // after ordering so trails stay together
        "frame.currentFrame" // final to make it quick
    ]
}

export function baseMarker(config, parent, id) {
    return observable(baseMarker.nonObservable(observable(config), parent, id), {
        config: observable.ref
    });
}

baseMarker.nonObservable = function(config, parent, id) {
    applyDefaults(config, defaultConfig);

    let pipelineTime = 0;
    let currentDataConfig;

    const marker = { config, id };
    const functions = {
        get data() {
            const datacfg = resolveRef(this.config.data);
            const dataConfig = dataConfigStore.get(datacfg, this);
            if (currentDataConfig && dataConfig != currentDataConfig) {
                currentDataConfig.dispose();
            }
            return currentDataConfig = dataConfig;
        },
        get requiredEncodings() { 
            return toJS(this.config.requiredEncodings || defaults.requiredEncodings).filter(
                enc => this.encoding[enc].data.hasOwnData
            ); 
        },
        encodingCache: encodingCache(),
        get encoding() {
            const validEncoding = config => config() && Object.keys(config()).length > 0
            const configGetters = [
                () => this.config.encoding, 
                () => this.data.source.defaultEncoding
            ];
            let configGetter = configGetters.find(validEncoding)
            if (!configGetter) {
                console.warn("No encoding found and marker data source has no default encodings");
                configGetter = () => ({});
            }
            // clone cache so computed is invalidated
            return Object.assign({}, this.encodingCache.update(configGetter(), this));
        },
        // TODO: encodings should know the property they encode to themselves; not sure how to pass generically yet 
        getEncodingName(encoding) {
            for (let [name, enc] of Object.entries(this.encoding)) {
                if (enc == encoding) return name;
            }
        },
        get promise() {
            return configSolver.markerPromiseBeforeSolving(this);
        },
        get configSolvingState() {
            return this.promise.state;
        },
        get state() {
            const dataConfigSolverState = this.promise.state;

            if (dataConfigSolverState == 'fulfilled') {
                if (this.encoding.frame?.changeBetweenFramesEncodings?.some(enc => this.encoding[enc].data.state !== 'fulfilled')) {
                    this.dataMapCache;
                } else {
                    this.dataMap 
                }
            }

            const encodingStates = [...Object.values(this.encoding)].map(enc => enc.state);
            const states = [dataConfigSolverState, ...encodingStates];
            return combineStates(states);
        },
        get availability() {
            const items = [];
            dataSourceStore.getAll().forEach(ds => {
                ds.availability.data.forEach(kv => {
                    items.push({ key: kv.key, value: ds.getConcept(kv.value), source: ds });
                })
            })
            return items;
        },
        get spaceAvailability() {
            const items = [];
            dataSourceStore.getAll().forEach(ds => {
                ds.availability.keyLookup.forEach((val, key) => {
                    items.push(val);
                })
            })
            return items;
        },
        get encodingByType() {

            const defining = [];
            const ammendWrite = []; // ammends by writing to object. Changes to encoding trigger pipeline, but pipeline is faster with direct writing.
            let ammendGet = []; // ammends by creating a getter. Allows changing config of encoding without triggering rest of pipeline.
            
            const transformFields = new Set(Object.values(this.encoding).map(enc => enc.transformFields).flat());

            for (const name of Object.keys(this.encoding)) {
                const fn = this.ammendFnForEncoding(name);

                if (typeof fn === 'function') {
                    if (transformFields.has(name)) {
                        ammendWrite.push(name);
                    } else {
                        ammendGet.push(name);
                    }
                } else if (fn === 'defining') {
                    defining.push(name);
                }

            }
                   
            // optimization: if ammending shares response with defining just let fullJoin handle it
            const definingResponses = defining.map(name => this.encoding[name].data.promise);
            ammendGet = ammendGet.filter(name => {
                const data = this.encoding[name].data;
                if (data.hasOwnData && definingResponses.includes(data.promise)) {
                    defining.push(name);
                    return false;
                }
                return true;
            })

            return {
                defining,
                ammendGet,
                ammendWrite
            }
        },
        ammendFnForEncoding(name) {
            const required = this.requiredEncodings;
            const data = this.encoding[name].data;
            const concept = data.concept;

            if (concept === undefined && !data.isConstant)
                return 'no-op'
            else if (data.isConstant) {
                return row => data.constant;
            } else if (data.conceptInSpace) {
                return row => row[concept];
            } else if (data.commonSpace.length < this.data.space.length) { 
                // proper subset
                // const response = data.response;
                return row => data.response.get(row)?.[concept];
            } else if (required.length > 0 && !required.includes(name)) {
                //const response = data.response;
                return (row, key) => data.response.getByStr(key)?.[concept];
            } else {
                return 'defining'; // defining encoding
            }
        },
        get encodingState() {
            const encs = [...this.encodingByType.defining, ...this.encodingByType.ammendWrite];
            return combineStates(encs.map(enc => this.encoding[enc].data.state));
        },
        // computed to cache calculation
        get dataMapCache() {
            trace();

            // prevent recalculating on each encoding data coming in
            if (this.encodingState !== 'fulfilled')
                return DataFrame([], this.data.space);

            console.time('dataMapCache');
            
            // define markers (full join encoding data)
            const { defining, ammendWrite, ammendGet } = this.encodingByType;
            const joinConfigs = defining.map(name => this.joinConfig(this.encoding[name], name));
            let dataMap = fullJoin(joinConfigs, this.data.space);

            // ammend markers with getter        
            for (const encName of ammendGet) {
                for (const markerKey of dataMap.keys()) {
                    const row = dataMap.get(markerKey); 
                    let fallback;
                    Object.defineProperty(row, encName, {
                        get: () => this.ammendFnForEncoding(encName)(row, markerKey) ?? fallback,
                        set(value) {
                            fallback = value;
                        },
                        enumerable: true,
                        configurable: true
                    })
                }
            }

            // ammend markers by writing
            const ammendFns = Object.fromEntries(ammendWrite.map(enc => [enc, this.ammendFnForEncoding(enc)]));
            for (const markerKey of dataMap.keys()) {
                const row = dataMap.get(markerKey);
                for (const name in ammendFns)
                    row[name] = ammendFns[name](row, markerKey);
            }
            
            console.timeEnd('dataMapCache');
            return dataMap;
        },
        joinConfig(encoding, name) {
            return { 
                projection: { 
                    [encoding.data.concept]: [ name ]
                },
                dataFrame: encoding.data.response
            }
        },
        requiredFilterSpec(required) {
            return { $nor: makeSpec(required) }
            function makeSpec(required) {
                return required.map(predicate => {
                    if (typeof predicate === 'string') {
                        return { $or: [ { [predicate]: { $eq: null } }, { [predicate]: { $eq: undefined } }] };
                    } else {
                        return Object.fromEntries(Object.entries(predicate).map(([key, value]) => {
                            return [key, makeSpec(value)]
                        }))
                    }
                })
            }
        },
        requiredSimpleFunction(required) {
            const l = required.length;
            return row => {
                for (let i = 0; i < l; i++) {
                    const v = row[required[i]];
                    if (v == null) return false;
                }
                return true;
            }
        },
        filterRequired(data) {            
            const required = this.requiredEncodings;
            let filter = required.every(isString)
                ? this.requiredSimpleFunction(required)
                : this.requiredFilterSpec(required)
            return data
                .filter(filter)
                .filterGroups(group => group.size > 0, true);
        },
        differentiate(xField, data) {
            const frame = this.encoding.frame
            return frame && this.encoding[xField] ? frame.differentiate(data, xField) : data
        },
        /**
         * transformationFns is an object 
         *  whose keys are transformation strings
         *  whose values are transformation functions
         */
        get transformationFns() {
            // marker transformation
            const transformations = {
                "filterRequired": this.filterRequired.bind(this)
            };
            // encoding transformations
            for (let [name, enc] of Object.entries(this.encoding)) {
                if (enc.transformationFns)
                    for (let [tName, t] of Object.entries(enc.transformationFns))
                        transformations[name + '.' + tName] = t;
                if (Array.isArray(enc?.config?.data?.transformations)) {
                    for (let tName of enc.config.data.transformations) {
                        const fn = this[tName];
                        if (fn)
                            transformations[name + '.' + tName] = fn.bind(this, name)
                    }
                }
            }
            return transformations;
        },
        /**
         * Transformations is an array of strings, referring to transformations defined on the marker or encodings
         * The array defines the order in which data will be transformed before being served.
         * If a function reference cannot be resolved, it will be skipped. No error will be thrown.
         * Encoding transformations are formatted "<encodingName>.<functionName>". E.g. "frame.currentFrame"
         * Marker transformations are formatted "<functionName>". E.g. "filterRequired"
         * This array of strings enables configuration of transformation order in a serializable format.
         */
        get transformations() {
            const transformations = this.config.transformations || defaults.transformations;
            const transformationFns = this.transformationFns;
            return transformations
                .filter(tStr => tStr in transformationFns)
                .map(tStr => ({
                        fn: this.transformationFns[tStr],
                        name: tStr
                }));
        },
        /**
         * transformedDataMaps is a ES6 Map
         *  whose keys are transformation strings or "final" and
         *  whose values are DataFrames wrapped in a boxed mobx computed. 
         *      The DataFrame is a result of the transformation function applied to the previous DataFrame.  
         */
        // currently all transformation steps are cached in computed values. Computeds are great to prevent recalculations
        // of previous steps when config of one step changes. However, it uses memory. We might want this more configurable.
        get transformedDataMaps() {
            //trace();
            // returns boxed computed, whose value can be reached by .get()
            // if we'd call .get() in here (returning the value), each change would lead to applying all transformations
            // because transformedDataMaps() would be observering all stepResults
            // would be nice to find a way for transformedDataMaps to just return the value instead of a boxed computed
            const results = new Map();
            let stepResult = observable.box(this.dataMapCache, { deep: false });
            this.transformations.forEach(({name, fn}) => {
                let prevResult = stepResult; // local reference for closure of computed
                stepResult = computed(
                    () => {
                        //trace();
                        const previous = prevResult.get();
                        const t0 = performance.now();
                        const result = fn(previous)
                        const t1 = performance.now();
                        pipelineTime += t1 - t0;
                        //console.log('Pipeline ' + fn.name + ':', t1-t0, 'Total:', pipelineTime);
                        return result;
                    }, 
                    { name }
                );
                results.set(name, stepResult);
            });
            results.set('final', stepResult);
            return results;
        },
        /**
         * Helper function to get values from transformedDataMaps. Used to prevent the awkward `.get(name).get()` syntax.
         */
        getTransformedDataMap(name) {
            if (this.transformedDataMaps.has(name))
                return this.transformedDataMaps.get(name).get();
            console.warn("Requesting unknown transformed data name: ", name);
        },
        get dataMap() {
            return this.transformedDataMaps.get('final').get();
        },
        get dataArray() {
            return this.dataMap?.toJSON();
        },
        getDataMapByFrameValue(value) {
            const frame = this.encoding.frame;
            if (!frame) return this.dataMap;
    
            const frameKey = createKeyFn([frame.name])({ [frame.name]: value });
            const data = this.getTransformedDataMap('filterRequired');
            return data.has(frameKey) ? 
                data.get(frameKey)
                :
                getInterpolatedFrame(frame, data, value);
    
            function getInterpolatedFrame(frame, data, value) {
                const step = frame.stepScale(value);
                const stepsAround = [Math.floor(step), Math.ceil(step)];
                return frame.getInterpolatedFrame(data, step, stepsAround);
            }
        },
        dispose() {
            // Need to dispose because reactions may not observe only locally. Through state -> dataConfig -> resolveRef they can indirectly observe stores.
            // https://mobx.js.org/reactions.html#mem-leak-example
            this.data.dispose();
            for (let enc of Object.values(this.encoding)) {
                enc.dispose();
            }
        }
    }

    return assign(marker, functions, configurable);
}

baseMarker.decorate = {
    encodingCache: observable.ref,
    encodingByType: computed.struct,
    requiredEncodings: computed.struct
}