import { action } from 'mobx';
import { deepmerge, assign, defaultDecorator } from "../utils";
import { configurable } from '../configurable';
import { csv, interpolate } from 'd3';
import { promisedComputed } from 'computed-async-mobx';

const defaultConfig = {
    reader: "csv",
    path: "data.csv",
    transforms: [],
    space: ['marker', 'time']
}

const functions = {
    get path() { return this.config.path },
    get transforms() { return this.config.transforms },
    get space() { return this.config.space },
    get reader() {
        this.config.reader.init({
            path: this.path
        })
        return this.config.reader;
    },
    get load() {
        //return promisedComputed([],
        //    async() => await csv(this.path, tryParseRow)
        //);
    },
    get data() {
        //return this.transforms.reduce(
        //    (data, t) => this[t.type](data, t),
        //    this.load.get()
        //);
        return [];
    },
    query: function(query) {
        //return [];
        console.log('Querying', query);
        return promisedComputed(null,
            async() => await this.reader.read(query).map(tryParseRow)
        );
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
            const groupKey = createKey(spaceRest, row);
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
        const int = interpolate(start.value, end.value);
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
    config = deepmerge.all([{}, defaultConfig, config]);
    return assign({}, functions, configurable, { config });
}