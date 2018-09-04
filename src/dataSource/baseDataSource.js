import { fromPromise, FULFILLED } from 'mobx-utils'
import { deepmerge, assign, createKeyStr, applyDefaults } from "../utils";
import { configurable } from '../configurable';
import { trace } from 'mobx';
import { dotToJoin, addExplicitAnd } from '../ddfquerytransform';
//import { csv, interpolate } from 'd3';

const defaultConfig = {
    type: "csv",
    path: "data.csv",
    transforms: []
}

const functions = {
    get path() { return this.config.path },
    get transforms() { return this.config.transforms },
    get space() { return this.config.space },
    get reader() {
        console.warn("Called stub dataSource.reader getter. No reader set.", this)
    },
    get load() {
        //return promisedComputed([],
        //    async() => await d3.csv(this.path, tryParseRow)
        //);
    },
    get data() {
        //return this.transforms.reduce(
        //    (data, t) => this[t.type](data, t),
        //    this.load.get()
        //);
        return [];
    },
    get availability() {
        const av = {
            key: new Map(),
            data: []
        }
        const val = this.availabilityPromise.case({
            fulfilled: v => v,
            pending: () => []
        })

        val.forEach(data => {
            data.forEach(row => {
                const key = Array.isArray(row.key) ? row.key : JSON.parse(row.key).sort();
                const keyStr = createKeyStr(key);
                av.data.push({ key, value: row.value });
                av.key.set(keyStr, key);
            });
        });
        return av;
    },
    get availabilityPromise() {
        const conceptsQuery = {
            select: {
                key: ["key", "value"],
                value: []
            },
            from: "concepts.schema"
        };
        const entitiesQuery = deepmerge.all([{}, conceptsQuery, { from: "entities.schema" }]);
        const datapointsQuery = deepmerge.all([{}, conceptsQuery, { from: "datapoints.schema" }]);

        return fromPromise(Promise.all([
            this.query(conceptsQuery),
            this.query(entitiesQuery),
            this.query(datapointsQuery)
        ]));
    },
    get conceptsPromise() {
        return this.query({
            select: {
                key: ["concept"],
                value: ["name", "domain", "concept_type"]
            },
            from: "concepts"
        });
    },
    get metaDataPromise() {
        return fromPromise(Promise.all([this.availabilityPromise, this.conceptsPromise]));
    },
    get concepts() {
        if (this.conceptsPromise.state != FULFILLED) return new Map();
        else return new Map(this.conceptsPromise.value.map(c => [c.concept, c]));
    },
    getConcept(conceptId) {
        if (conceptId == "concept_type" || conceptId.indexOf('is--') === 0)
            return { concept: conceptId, name: conceptId }
        return this.concepts.get(conceptId);
    },
    isEntityConcept(conceptId) {
        return ["entity_set", "entity_domain"].includes(this.getConcept(conceptId).concept_type);
    },
    query: function(query) {
        //return [];
        query = dotToJoin(query);
        query = addExplicitAnd(query);
        console.log('Querying', query);
        const readPromise = this.reader.read(query).then(data => data.map(tryParseRow));
        return fromPromise(readPromise);
    },
    interpolate: function(data, { dimension, concepts, step }) {
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
            const groupKey = createMarkerKey(spaceRest, row);
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
    interpolatePoint: function(start, end) {
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