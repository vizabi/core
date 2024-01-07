import { fromPromise } from 'mobx-utils'
import { assign, applyDefaults, deepclone, stableStringifyObject, concatUnique, sleep, lazyAsync, combineStates, createModel } from "../utils";
import { configurable } from '../configurable';
import { trace, observable, toJS, reaction } from 'mobx';
import { dotToJoin, addExplicitAnd } from '../ddfquerytransform';
import { DataFrame } from '../../dataframe/dataFrame';
import { inlineReader } from '../../reader/inline/inline';
import { csvReader } from '../../reader/csv/csv';
import { createKeyStr, isDataFrame } from '../../dataframe/dfutils';
import { makeCache } from './cache';

let normalizingTime = 0;

const defaultConfig = {
    path: null,
    sheet: null,
    keyConcepts: null,
    values: null,
    transforms: []
}

export const type = "dataSource"

export function dataSource(...args) {
    return createModel(dataSource, ...args)
}

dataSource.nonObservable = function (config, parent, id) {
    applyDefaults(config, defaultConfig);


    const functions = {
        get path() { return this.config.path },
        get sheet() { return this.config.sheet },
        get keyConcepts() { return this.config.keyConcepts },
        get locale() { 
            if (this.config.locale)
                return typeof this.config.locale == "string" ? this.config.locale : this.config.locale.id; 
        },
        get dtypes() { return this.config.dtypes },
        get reader() {
            if (this.values)
                return inlineReader({ values: this.values, keyConcepts: this.keyConcepts, dtypes: this.dtypes });
            else if (this.path)
                return csvReader(this.config, this.id);
            console.warn("No inline values or csv path found. Please set `values` or `path` property on dataSource.", this)
        },
        get values() { 
            // toJS: don't want insides of data to be observable (adds overhead & complexity)
            return toJS(this.config.values);
        },
        get defaultEncodingPromise() {
            if ("getDefaultEncoding" in this.reader)
                return fromPromise(this.reader.getDefaultEncoding());
            else    
                return fromPromise.resolve({});
        },
        get defaultEncoding() {
            const empty = {};
            return this.defaultEncodingPromise.case({
                fulfilled: v => {
                    Object.values(v).forEach(enc => enc.source = this)
                    return v;
                },
                pending: () => { console.warn('Requesting default encoding before loaded. Will return empty. Recommended to await promise.'); return empty },
                error: (e) => { console.warn('Requesting default encoding when loading errored. Will return empty. Recommended to catch exception.'); return empty }
            });
        },
        buildAvailability(responses = []) {
            const 
                keyValueLookup = new Map(),
                keyLookup = new Map(),
                valueLookup = new Map(),
                data = [];
    
            /* utility functions, probably move later */
            const getFromMap = (map, key, getNewVal) => {
                map.has(key) || map.set(key, getNewVal());
                return map.get(key);
            }
            const newSet = () => new Set();
            const newMap = () => new Map();
    
            /* handle availability responses */
            responses.forEach(response => {
                response = response.forQueryKey().values(); // get dataframe iterator if there
                for(let row of response) {
                    let keyStr;
                    row.key = Array.isArray(row.key) ? row.key : JSON.parse(row.key).sort();
                    keyStr = createKeyStr(row.key);
                    data.push(row);
                    keyLookup.set(keyStr, row.key);
                    getFromMap(keyValueLookup, keyStr, newMap)
                        .set(row.value, row);  
                    getFromMap(valueLookup, row.value, newSet)
                        .add(row.key);
                };
            });
    
            return {
                valueLookup,
                keyValueLookup,
                keyLookup,
                data
            };
        },
        get availabilityPromise() { return this.fetchAvailability(); },
        fetchAvailability() {
            //trace();
            const collections = ["concepts", "entities", "datapoints"];
            const getCollAvailPromise = (collection) => this.query({
                select: {
                    key: ["key", "value"],
                    value: []
                },
                from: collection + ".schema"
            });
    
            return fromPromise(Promise.all(collections.map(getCollAvailPromise))
                .then(this.buildAvailability));
        },
        get availabilityState() {
            if (this.availabilityPromise.state == 'rejected') 
                throw this.availabilityPromise.value;
            return this.availabilityPromise.state;
        },
        get availability() {
            let empty = this.buildAvailability();
            return this.availabilityPromise.case({
                fulfilled: v => v,
                pending: () => { console.warn('Requesting availability before availability loaded. Will return empty. Recommended to await promise.'); return empty },
                rejected: (e) => { console.warn('Requesting availability when loading errored. Will return empty. Recommended to catch exception.'); return empty }
            })
        },
        get conceptsPromise() { return this.fetchConcepts(); },
        fetchConcepts() {
            //trace();
            const locale = this.locale
            return fromPromise(this.availabilityPromise.then(av => {
                const conceptKeyString = createKeyStr(["concept"]);
                const avConcepts = [...av.keyValueLookup.get(conceptKeyString).keys()];
        
                const query = {
                    select: {
                        key: ["concept"],
                        value: avConcepts
                    },
                    from: "concepts"
                };         
                  
                if (locale) {
                    query.language = locale; 
                }
    
                return this.query(query)
            }));
        },
        get conceptsState() {
            //trace();
            if (this.conceptsPromise.state == 'rejected') 
                throw this.conceptsPromise.value;
            return this.conceptsPromise.state;
        },
        get concepts() {
            //trace();
            const empty = new Map();
            return this.conceptsPromise.case({
                fulfilled: v => v.forQueryKey(),
                pending: () => { console.warn('Requesting concepts before loaded. Will return empty. Recommended to await promise.'); return empty; },
                rejected: (e) => { console.warn('Requesting concepts when loading errored. Will return empty. Recommended to catch exception.'); return empty; }
            })
        },
        /* 
        *  separate state computed which don't become stale with new promise in same state  
        */
        get state() {
            return combineStates([this.availabilityState, this.conceptsState]);
        },
        getConcept(concept) {
            if (concept == "concept_type" || concept.indexOf('is--') === 0 || concept === "concept")
                return { concept, name: concept }
            if (this.concepts.size && !this.concepts.has({ concept }))
                console.warn("Could not find concept " + concept + " in data source ", this);
            return this.concepts.get({ concept }) || {};
        },
        isEntityConcept(conceptId) {
            return ["entity_set", "entity_domain"].includes(this.getConcept(conceptId).concept_type);
        },
        isTimeConcept(conceptId) {
            return this.getConcept(conceptId).concept_type === "time";
        },
        normalizeResponse(response, query) {
            const cache = {}
            if (isDataFrame(response)) {
                cache[createKeyStr(response.key)] = response;
            } else if (response.length == 1 && Object.keys(response[0]).length == 0) {
                // to handle faulty bw/ddfservice reader response
                // https://github.com/Gapminder/big-waffle/issues/53
                response.pop();
            }
            function forKey(key) {
                //const t0 = performance.now();   
                const keyStr = createKeyStr(key);
                const df = cache[keyStr] ?? (cache[keyStr] = DataFrame(response, key)); 
                //const time = performance.now() - t0;
                //normalizingTime += time;
                //console.log('normalized: ', time, 'total: ' + normalizingTime)
                return df;
            }
            function forQueryKey() {
                return forKey(query.select.key);
            }
            return {
                //Sometimes the raw response is a dataframe (such as from CSV/inline reader)
                //And sometimes it's a plain array (such as from ws-service reader)
                //Some downstream code however expects "raw" to be a plain array, 
                //for example, the for loop in entityPropertyDataConfig.js: lookups()
                //hence, this converts response back to plain array
                raw: isDataFrame(response) ? [...response.values()] : response,
                forKey,
                forQueryKey
            }
        },
        query(query) {
            query = dotToJoin(query);
            query = addExplicitAnd(query);
            //console.log('Processing query', query);
            return this.combineAndSendQueries(query);
        },
        cache: makeCache(),
        queue: new Map(),
        combineAndSendQueries(query) {
            if (this.cache.has(query)) 
                return this.cache.get(query);

            //find out which queries can be combined (stringify all fields minus select.value)
            const queryCombineId = this.calcCombineId(query);
            if (this.queue.has(queryCombineId)) {
                //add an extra column to a query already found in the queue
                const { baseQuery, promise } = this.queue.get(queryCombineId);
                baseQuery.select.value = concatUnique(baseQuery.select.value, query.select.value);
                return promise;
            } else {
                //create a new query in a queue
                const baseQuery = deepclone(query);
                const promise = fromPromise(this.sendDelayedQuery(baseQuery));
                this.queue.set(queryCombineId, { baseQuery, promise })
                this.cache.set(baseQuery, promise);
                return promise;
            }
        },
        async sendDelayedQuery(query) {
            const reader = this.reader; // deref read before await so it's observed & memoized
            // sleep first so other queries can fill up baseQuery's select.value
            await sleep();
            const queryCombineId = this.calcCombineId(query);
            //after deleting from the queue nothing more can be added to the query
            this.queue.delete(queryCombineId);
            const response = await reader.read(query);
            return this.normalizeResponse(response, query);
        },

        _getDrillupCatalog(concepts = this.concepts) {
            const promises = [];
            const result = {};
            const drillup = "drill_up";

            for (const conceptKeys of this.availability.keyLookup.values()) {
                if (conceptKeys.length == 1 && this.isEntityConcept(conceptKeys[0])) {
                    const conceptId = conceptKeys[0];
                    const concept = concepts.get(conceptId);
                    if (concept[drillup]) {
                        const dim = concept["domain"] || conceptId;
                        if (!result[dim]) result[dim] = {};
                        const drillups = JSON.parse(concept[drillup]);
                        const entityQuery = { 
                            select: {
                                key: [conceptId],
                                value: [...drillups]
                            },
                            from: "entities",
                            locale: this.locale,
                        };
                        promises.push(this.query(entityQuery).then(response => {
                            result[dim][conceptId] = [];

                            const res = response.forQueryKey();
                            result[dim][conceptId].push([Symbol.for(drillup), res]);
                            drillups.forEach(drillup => {
                                result[dim][conceptId].push(...res.groupByWithMultiGroupMembership(drillup).filterGroups(( _, k) => {
                                    return k !== "";
                                }, true).entries());
                            });
                            result[dim][conceptId] = new Map(result[dim][conceptId]);
                        }));
                    }
                }
            }

            return fromPromise(Promise.all(promises).then(() => result));
        },

        enableDrillup: false,

        get drillupCatalog() {
            if (this.enableDrillup) {
                return this._getDrillupCatalog();
            } else {
                return fromPromise.resolve({});
            }
        },

        //.drilldown({dim: "geo", entity: "asia"}) // =>{country: ["chn", "ind", "idn" ..... ]}
        //.drilldown({dim: "geo", entity: "usa"}) // => {country: ["usa"]}
        //.drilldown({dim: "geo", entity: ["landlocked"]}) // => {country: ["afg", "rwa",  .... ]}
        //.drilldown({dim: "geo", entity: ["usa", "landlocked"]}) // => {country: ["afg", "rwa",  ...., "usa"]} (same plus USA)
        //.drilldown({dim: "geo", entity: ["asia", "landlocked"]}) // => {country:  [chn", "ind", "afg", "rwa",  .... ] } 
        
        drilldown(obj) {
            this.enableDrillup = true;

            const entities = Array.isArray(obj.entity) ? obj.entity : [obj.entity];
            const concept = this.concepts.get(obj.dim);
            const dim = concept.domain ? concept.domain : obj.dim;

            return this.drillupCatalog.then(c => {
                const result = {}; 
                for (const entitySet in c[dim]) {
                    const founded = [];
                    entities.forEach(e => {
                        if (c[dim][entitySet].has(e)) {
                            founded.push(...[...c[dim][entitySet].get(e).values()].map(v => v[entitySet]));
                        } else if (c[dim][entitySet].get(Symbol.for("drill_up")).has(e)){
                            founded.push(e);
                        }
                    })
                    if (founded.length) {
                        result[entitySet] = [...new Set(founded)].sort();
                    }
                };
                return Object.keys(result).length ? result : null;
            });
        },

        //.drillup({dim: "geo", entity: "usa"}) // => {world_4region: americas, landlocked: coastline, religion: christian ...}
        drillup(obj) {
            this.enableDrillup = true;

            const concept = this.concepts.get(obj.dim);
            const dim = concept.domain ? concept.domain : obj.dim;
            const drillup = "drill_up";

            const result = {};
            return this.drillupCatalog.then(c => {
                for (const entitySet in c[dim]) {
                    const drillupValue = c[dim][entitySet].get(Symbol.for(drillup)).get(obj.entity);
                    Object.assign(result, drillupValue);
                    delete result[entitySet];
                    delete result[Symbol.for("key")];
                };
                return result;

            });

        },

        calcCombineId(query) {
            const clone = deepclone(query);
            delete clone.select.value;
            return stableStringifyObject(clone);
        },
        disposers: [],
        onCreate() {
            this.disposers.push(
                reaction(() => this.state == 'fulfilled' ? this.drillupCatalog : {}, ()=>{})
            );
        },
        dispose() {
            let dispose;
            while (dispose = this.disposers.pop()) {
                dispose();
            }
        }
    }

    return assign({}, functions, configurable, { config, id, type });
}

dataSource.decorate = {
    // to prevent config.values from becoming observable
    // possibly paints with too broad a brush, other config might need to be deep later
    config: observable.shallow,
    // queue should be mutable by computed methods 
    // this is introducing state manipulation and makes these computed methods impure 
    // other solutions are welcome : ) 
    queue: observable.ref,
    cache: observable.ref
}