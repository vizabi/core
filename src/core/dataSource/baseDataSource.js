import { computedFn, fromPromise, FULFILLED } from 'mobx-utils'
import { assign, applyDefaults, defer, deepclone, pipe, stableStringifyObject } from "../utils";
import { configurable } from '../configurable';
import { trace, observable, toJS } from 'mobx';
import { dotToJoin, addExplicitAnd } from '../ddfquerytransform';
import { DataFrame } from '../../dataframe/dataFrame';
import { inlineReader } from '../../reader/inline/inline';
import { csvReader } from '../../reader/csv/csv';
import { createKeyStr } from '../../dataframe/utils';
import { makeCache } from '../dataConfig/cache';

const defaultConfig = {
    path: null,
    sheet: null,
    keyConcepts: null,
    values: null,
    transforms: []
}

const functions = {
    get path() { return this.config.path },
    get sheet() { return this.config.sheet },
    get keyConcepts() { return this.config.keyConcepts },
    get space() { return this.config.space },
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
            fulfilled: v => DataFrame(v, ["concept"]),
            pending: () => { console.warn('Requesting concepts before loaded. Will return empty. Recommended to await promise.'); return empty },
            error: (e) => { console.warn('Requesting concepts when loading errored. Will return empty. Recommended to check promise.'); return empty }
        })
    },
    get defaultEncodingPromise() {
        if ("getDefaultEncoding" in this.reader)
            return this.reader.getDefaultEncoding();
        else    
            return Promise.resolve({});
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
            data = [];

        /* utility functions, probably move later */
        const getFromMap = (map, key, getNewVal) => {
            map.has(key) || map.set(key, getNewVal());
            return map.get(key);
        }
        const getNewMap = () => new Map();
        const getMapFromMap = (map, key) => getFromMap(map, key, getNewMap);

        /* handle availability responses */
        responses.forEach(response => {
            response = response.values ? response.values() : response; // get dataframe iterator if there
            for(let row of response) {
                let keyStr, valueLookup;
                row.key = Array.isArray(row.key) ? row.key : JSON.parse(row.key).sort();
                keyStr = createKeyStr(row.key);
                data.push(row);
                keyLookup.set(keyStr, row.key);
                valueLookup = getMapFromMap(keyValueLookup, keyStr);
                valueLookup.set(row.value, row);    
            };
        });

        return {
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
    query(query) {
        //return [];
        if (!query._id) {
            query._id = this.identity;
        }
        query = dotToJoin(query);
        query = addExplicitAnd(query);
        //console.log('Adding to queue', query);
        const queryPromise = this.enqueue(query);
        return fromPromise(queryPromise);
    },
    //queue: [],
    get queue() {
        return [];
    },
    enqueue(query) {
        return new Promise((resolve, reject) => {
            this.queue.push({ query, resolves: [resolve], rejects: [reject] });
            // defer so queue can fill up before queue is processed
            // only first of deferred process calls will find a filled queue
            defer(() => this.processQueue(this.queue));
        })
    },
    processQueue(queue) {
        return pipe(
            this.resolveCached.bind(this),
            this.combineQueries.bind(this), 
            this.sendQueries.bind(this),
            this.setQueueHandlers.bind(this),
            this.addToCache.bind(this),
            this.clearQueue.bind(this)
        )(queue);
    },
    combineQueries(queue) {
        const queries = queue.reduce((queries, { query, resolves, rejects }) => {
            const queryCombineId = this.calcCombineId(query);
            if (queries.has(queryCombineId)) {
                const { 
                    query: combinedQuery, 
                    resolves: combinedResolves, 
                    rejects: combinedRejects 
                } = queries.get(queryCombineId);
                const additionalValues = query.select.value.filter(v => combinedQuery.select.value.includes(v) === false)
                combinedQuery.select.value.push(...additionalValues);
                combinedResolves.push(...resolves);
                combinedRejects.push(...rejects);
            } else {
                queries.set(queryCombineId, {
                    query: deepclone(query),
                    resolves,
                    rejects
                });
            }
            return queries;
        }, new Map());
        return [...queries.values()];
    },
    cache: makeCache(),
    resolveCached(queries) {
        return queries.filter(query => !this.tryCache(query));
    },
    tryCache({ query, resolves }) {
        let response;
        if (response = this.cache.get(query)) {
            console.warn('Resolving query from cache.', query);
            resolves.forEach(resolve => resolve(response));
            return true;
        }
        return false;
    },
    sendQueries(queries) {
        return queries.map(({ query, resolves, rejects }) => {
            //console.log('Sending query to reader', query);
            const promise = this.reader.read(query);
            return {
                query, resolves, rejects, promise
            };
        });
    },
    setQueueHandlers(queries) {
        queries.forEach(({ promise, resolves, rejects }) => {
            resolves.forEach(res => promise.then(res));
            rejects.forEach(rej => promise.catch(rej));
        })
        return queries;
    },
    addToCache(queries) {
        queries.forEach(({ query, promise }) => {
            this.cache.setFromPromise(query, promise);
        });
        return queries;
    },
    clearQueue() {
        this.queue.length = 0; // reset without changing ref
    },
    calcCombineId(query) {
        const clone = deepclone(query);
        delete clone.select.value;
        return stableStringifyObject(clone);
    }
}

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

export function baseDataSource(config) {
    applyDefaults(config, defaultConfig);
    return assign({}, functions, configurable, { config });
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