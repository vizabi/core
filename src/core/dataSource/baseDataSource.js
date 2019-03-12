import { fromPromise, FULFILLED } from 'mobx-utils'
import { assign, createKeyStr, applyDefaults } from "../utils";
import { configurable } from '../configurable';
import { trace } from 'mobx';
import { dotToJoin, addExplicitAnd } from '../ddfquerytransform';
import { DataFrame } from '../../dataframe/dataFrame';
import { inlineReader } from '../../reader/inline';
import { csvReader } from '../../reader/csv';

const defaultConfig = {
    path: null,
    values: null,
    transforms: []
}

const functions = {
    get path() { return this.config.path },
    get space() { return this.config.space },
    get reader() {
        if (this.values)
            return inlineReader({ values: this.values });
        else if (this.path)
            return csvReader({ path: this.path });
        console.warn("Called stub dataSource.reader getter. No reader set.", this)
    },
    get values() { return this.config.values },
    get availability() {
        let empty = this.buildAvailability();
        return this.availabilityPromise.case({
            fulfilled: v => this.buildAvailability(v),
            pending: () => { console.warn('Requesting availability before availability loaded. Will return empty. Recommended to await promise.'); return empty },
            error: (e) => { console.warn('Requesting availability when loading errored. Will return empty. Recommended to check promise.'); return empty }
        })
    },
    get concepts() {
        const empty = new Map();
        return this.conceptsPromise.case({
            fulfilled: v => DataFrame(v, ["concept"]),
            pending: () => { console.warn('Requesting concepts before loaded. Will return empty. Recommended to await promise.'); return empty },
            error: (e) => { console.warn('Requesting concepts when loading errored. Will return empty. Recommended to check promise.'); return empty }
        })
    },
    get defaultEncodingPromise() {
        if ("getDefaultEncoding" in this.reader)
        return fromPromise(this.reader.getDefaultEncoding());
    },
    get defaultEncoding() {
        const empty = {};
        return this.defaultEncodingPromise.case({
            fulfilled: v => v,
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
        const collections = ["concepts", "entities", "datapoints"];
        const getCollAvailPromise = (collection) => this.query({
            select: {
                key: ["key", "value"],
                value: []
            },
            from: collection + ".schema"
        });

        return fromPromise(
            Promise.all(collections.map(getCollAvailPromise))
        );
    },
    get conceptsPromise() {
        
        const createConceptsPromise = () => {
            const concepts = ["name", "domain", "concept_type"];
            const conceptKeyString = createKeyStr(["concept"]);
            const avConcepts = concepts.filter(c => this.availability.keyValueLookup.get(conceptKeyString).has(c));
    
            const query = {
                select: {
                    key: ["concept"],
                    value: avConcepts
                },
                from: "concepts"
            };
    
            return this.query(query);
        }

        const p = this.availabilityPromise.case({
            pending: () => new Promise(() => undefined),
            fulfilled: (d) => createConceptsPromise(),
            rejected: (e) => Promise.reject(e)
        });
        return fromPromise(p);
    },
    get metaDataPromise() {
        return fromPromise(
            Promise.all([this.availabilityPromise, this.conceptsPromise, this.defaultEncodingPromise])
        );
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
    get metaDataState() {
        return this.metaDataPromise.state;
    },
    getConcept(concept) {
        if (concept == "concept_type" || concept.indexOf('is--') === 0)
            return { concept, name: concept }
        if (!this.concepts.has({ concept }))
            console.warn("Could not find concept " + concept + " in data source ", this);
        return this.concepts.get({ concept });
    },
    isEntityConcept(conceptId) {
        return ["entity_set", "entity_domain"].includes(this.getConcept(conceptId).concept_type);
    },
    query(query) {
        //return [];
        query = dotToJoin(query);
        query = addExplicitAnd(query);
        console.log('Querying', query);
        const readPromise = this.reader.read(query); // .then(data => data.map(tryParseRow));
        return fromPromise(readPromise);
    },
    interpolate(data, { dimension, concepts, step }) {
        const space = this.space;
        if (!space.includes(dimension))
            throw ("data transform, interpolate: dimension not included in data space.", { space, dimension });
        if (data.length <= 0)
            return data;


        // sort by interpolation dimension
        data.sort((a, b) => a[dimension] - b[dimension]);

        // group by other dimensions (Map preserves sorting)
        const spaceRest = this.space.filter(v => v != dimension);
        const groupMap = new Map();
        data.forEach(row => {
            const groupKey = createMarkerKey(row, spaceRest);
            if (groupMap.has(groupKey))
                groupMap.get(groupKey).set(row[dimension], row);
            else
                groupMap.set(groupKey, new Map([
                    [row[dimension], row]
                ]));
        });

        // handle each group (= marker) seperately
        for (let [groupKey, groupData] of groupMap) {
            var previousMarkerValues = new Map();

            let previous = {};
            for (let [frameId, row] of groupData) {

                // for every interpolation-concept with data in row
                concepts
                    .filter(concept => row[concept] != null)
                    .forEach(concept => {
                        // if there is a previous value and gap is > step
                        if (previous[concept] && previous[concept].frameId + step < frameId) {
                            // interpolate and save results in frameMap
                            this.interpolatePoint(previous[concept], { frameId, value: row[concept] })
                                .forEach(({ frameId, value }) => {
                                    // could maybe be optimized with batch updating all interpolations
                                    let frame;

                                    // get/create right frame
                                    if (groupData.has(frameId)) {
                                        frame = groupData.get(frameId);
                                    } else {
                                        frame = {
                                            [dimension]: frameId
                                        };
                                        spaceRest.forEach(dim => frame[dim] = row[dim]);
                                        groupData.set(frameId, frame);
                                    }

                                    // add value to marker
                                    frame[concept] = value;
                                });
                        }

                        // update previous value to current
                        previous[concept] = {
                            frameId,
                            value: row[concept]
                        }
                    });
            }
        }

        const flatData = [...groupMap.values()].reduce((prev, cur) => {
            return [...prev.values(), ...cur.values()];
        }, new Map());

        return flatData;
    },
    interpolatePoint(start, end) {
        const int = d3.interpolate(start.value, end.value);
        const delta = end.frameId - start.frameId;
        const intVals = [];
        for (let i = 1; i < delta; i++) {
            const frameId = start.frameId + i;
            const value = int(i / delta);
            intVals.push({ frameId, value })
        }
        return intVals;
    }

}

const tryParseRow = d => {
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