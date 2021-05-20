import { trace, reaction, computed, observable, isComputed, isBoxedObservable, when, toJS } from 'mobx';
import { dataSourceStore } from '../dataSource/dataSourceStore'
import { dataConfigStore } from '../dataConfig/dataConfigStore'
import { assign, applyDefaults, isProperSubset, combineStates } from "../utils";
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
        "frame.frameMap",
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
        get requiredEncodings() { return toJS(this.config.requiredEncodings || defaults.requiredEncodings) },
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
        get state() {
            const dataConfigSolverState = this.promise.state;
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
        // computed to cache calculation
        get dataMapCache() {
            //trace();
            console.time('dataMapCache');
            // prevent recalculating on each encoding data coming in
            if (this.state !== "fulfilled") 
                return DataFrame([], this.data.space);
    
            const markerDefiningEncodings = [];
            let markerAmmendingEncodings = [];
            const spaceEncodings = [];
            const constantEncodings = [];
    
            // sort visual encodings by how they add data to markers
            for (let [name, encoding] of Object.entries(this.encoding)) {
    
                // no data or constant, no further processing (e.g. selections)
                if (encoding.data.concept === undefined && !encoding.data.isConstant)
                    continue;
    
                // constants value (ignores other config like concept etc)
                else if (encoding.data.isConstant)
                    constantEncodings.push({ name, encoding });
    
                // copy data from space/key
                else if (encoding.data.conceptInSpace)
                    spaceEncodings.push({ name, encoding });
                
                // own data, not defining final markers (not required or proper subspace)
                else if (isProperSubset(encoding.data.space, this.data.space) || !this.isRequired(name))
                    markerAmmendingEncodings.push(this.joinConfig(encoding, name));
    
                // own data, superspace (includes identical space) and required defining markers
                else
                    markerDefiningEncodings.push(this.joinConfig(encoding, name));
    
            }
                   
            // optimization: if ammending is not required but does share response with defining just let fullJoin handle it
            const definingDFs = markerDefiningEncodings.map(defJC => defJC.dataFrame);
            markerAmmendingEncodings = markerAmmendingEncodings.filter(ammending => {
                if (definingDFs.includes(ammending.dataFrame)) {
                    markerDefiningEncodings.push(ammending);
                    return false;
                }
                return true;
            });
    
            // define markers (full join encoding data)
            let dataMap = fullJoin(markerDefiningEncodings, this.data.space);
            // ammend markers with non-defining data, constants and copies of space
            dataMap = dataMap.leftJoin(markerAmmendingEncodings);
            constantEncodings.forEach(({name, encoding}) => {
                dataMap = dataMap.addColumn(name, encoding.data.constant);
            })
            spaceEncodings.forEach(({name, encoding}) => {
                const concept = encoding.data.concept;
                dataMap = dataMap.addColumn(name, row => row[concept]);
            });
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
        isRequired(name) {
            return this.requiredEncodings.length === 0 || this.requiredEncodings.includes(name)
        },
        filterRequired(data) {            
            const required = this.requiredEncodings.filter(
                enc => !this.encoding[enc].data.isConstant && !this.encoding[enc].data.conceptInSpace
            );
            const l = required.length;
            return data
                .filter(row => {
                    for (let i = 0; i < l; i++) {
                        const v = row[required[i]];
                        if (v === undefined || v === null) return false;
                    }
                    return true;
                })
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
                if (enc.config && enc.config.data && enc.config.data.transformations instanceof Array) {
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
    encodingCache: observable.ref
}