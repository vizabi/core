import { computedFn, fromPromise, FULFILLED } from 'mobx-utils'
import { assign, applyDefaults, defer, deepclone, pipe, stableStringifyObject, relativeComplement, concatUnique, sleep } from "../utils";
import { configurable } from '../configurable';
import { trace, observable, toJS } from 'mobx';
import { dotToJoin, addExplicitAnd } from '../ddfquerytransform';
import { DataFrame } from '../../dataframe/dataFrame';
import { inlineReader } from '../../reader/inline/inline';
import { csvReader } from '../../reader/csv/csv';
import { arrayEquals, createKeyStr, isDataFrame, normalizeKey } from '../../dataframe/dfutils';
import { makeCache } from '../dataConfig/cache';

let normalizingTime = 0;

const defaultConfig = {
    path: null,
    sheet: null,
    keyConcepts: [],
    values: null,
    transforms: []
}

export const type = "dataSource"

const tryParse = data => {
    for (let row of data) {
        tryParseRow(row);
    }
    return data;
}

const tryParseRow = d => {
    //return d3.autoType(d);
    for (let key in d) {
        d[key] = parse(d[key]);
    }
    return d;
}

const parse = (val) => (val == '') ? null : +val || val;

export function baseDataSource(config, parent, id) {
    return observable(
        baseDataSource.nonObservable(observable(config), parent, id), 
        baseDataSource.decorate
    );
}

baseDataSource.nonObservable = function (config, parent, id) {
    applyDefaults(config, defaultConfig);


    const functions = {
        get path() { return this.config.path },
        get sheet() { return this.config.sheet },
        get keyConcepts() { return this.config.keyConcepts },
        get space() { return this.config.space },
        get locale() { 
            if (this.config.locale)
                return typeof this.config.locale == "string" ? this.config.locale : this.config.locale.id; 
        },
        get dtypes() { return this.config.dtypes },
        get reader() {
            if (this.values)
                return inlineReader({ values: this.values, keyConcepts: this.keyConcepts, dtypes: this.dtypes });
            else if (this.path)
                return csvReader({ path: this.path, sheet: this.sheet, keyConcepts: this.keyConcepts, dtypes: this.dtypes });
            console.warn("No inline values or csv path found. Please set `values` or `path` property on dataSource.", this)
        },
        get values() { 
            // toJS: don't want insides of data to be observable (adds overhead & complexity)
            return toJS(this.config.values);
        },
        get availability() {
            let empty = this.buildAvailability();
            return this.availabilityPromise.case({
                fulfilled: v => v,
                pending: () => { console.warn('Requesting availability before availability loaded. Will return empty. Recommended to await promise.'); return empty },
                error: (e) => { console.warn('Requesting availability when loading errored. Will return empty. Recommended to check promise.'); return empty }
            })
        },
        get concepts() {
            //trace();
            const empty = new Map();
            return this.conceptsPromise.case({
                fulfilled: v => v.forQueryKey(),
                pending: () => { console.warn('Requesting concepts before loaded. Will return empty. Recommended to await promise.'); return empty },
                error: (e) => { console.warn('Requesting concepts when loading errored. Will return empty. Recommended to check promise.'); return empty }
            })
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
                error: (e) => { console.warn('Requesting default encoding when loading errored. Will return empty. Recommended to check promise.'); return empty }
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
        get availabilityPromise() {
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
        get conceptsPromise() {
            //trace();
            const locale = this.locale
            return fromPromise(this.availabilityPromise.then(av => {
                if (locale != this.locale)
                    return; // abort since there's a newer locale and thus a new conceptPromise
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
    
                return this.query(query);
            }));
        },
        get metaDataPromise() {
            return fromPromise(Promise.all([this.availabilityPromise, this.conceptsPromise, this.defaultEncodingPromise]));
        },
        /* 
        *  separate state computed which don't become stale with new promise in same state 
        *  might use these later to make own .case({pending, fulfilled, rejected}) functionality    
        */
        get availabilityState() {
            return this.availabilityPromise.state;
        },
        get conceptsState() {
            return this.conceptsPromise.state;
        },
        get state() {
            return this.metaDataPromise.state;
        },
        get identity() {
            return stableStringifyObject(this.config);
        },
        getConcept(concept) {
            if (concept == "concept_type" || concept.indexOf('is--') === 0 || concept === "concept")
                return { concept, name: concept }
            if (!this.concepts.has({ concept }))
                console.warn("Could not find concept " + concept + " in data source ", this);
            return this.concepts.get({ concept }) || {};
        },
        isEntityConcept(conceptId) {
            return ["entity_set", "entity_domain"].includes(this.getConcept(conceptId).concept_type);
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
                const t0 = performance.now();   
                const keyStr = createKeyStr(key);
                const df = cache[keyStr] ?? (cache[keyStr] = DataFrame(response, key)); 
                const time = performance.now() - t0;
                normalizingTime += time;
                //console.log('normalized: ', time, 'total: ' + normalizingTime)
                return df;
            }
            function forQueryKey() {
                return forKey(query.select.key);
            }
            return {
                raw: response,
                forKey,
                forQueryKey
            }
        },
        query(query) {
            //return [];
            if (!query._id) {
                query._id = this.identity;
            }
            query = dotToJoin(query);
            query = addExplicitAnd(query);
            //console.log('Processing query', query);
            return this.combineAndSendQueries(query);
        },
        cache: makeCache(),
        get queue() {
            return new Map();
        },
        combineAndSendQueries(query) {
            if (this.cache.has(query)) 
                return this.cache.get(query);

            const queryCombineId = this.calcCombineId(query);
            if (this.queue.has(queryCombineId)) {
                const { baseQuery, promise } = this.queue.get(queryCombineId);
                baseQuery.select.value = concatUnique(baseQuery.select.value, query.select.value);
                return promise;
            } else {
                const baseQuery = deepclone(query);
                const promise = fromPromise(this.sendDelayedQuery(baseQuery));
                this.queue.set(queryCombineId, { baseQuery, promise })
                this.cache.set(baseQuery, promise);
                return promise;
            }
            
        },
        async sendDelayedQuery(query) {
            // sleep first so other queries can fill up baseQuery's select.value
            await sleep();
            const queryCombineId = this.calcCombineId(query);
            this.queue.delete(queryCombineId);
            const response = await this.reader.read(query);
            return this.normalizeResponse(response, query);
        },
        calcCombineId(query) {
            const clone = deepclone(query);
            delete clone.select.value;
            return stableStringifyObject(clone);
        }
    }

    return assign({}, functions, configurable, { config, id, type });
}

baseDataSource.decorate = {
    // to prevent config.values from becoming observable
    // possibly paints with too broad a brush, other config might need to be deep later
    config: observable.shallow,
    // queue should be mutable by computed methods
    // this is introducing state manipulation and makes these computed methods impure
    // other solutions are welcome : )
    //queue: observable.ref,
    cache: observable.ref
}