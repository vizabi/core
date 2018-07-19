import { observable, action } from 'mobx';
import { assign, processConfig, createKey, deepmerge } from "../utils";

const createObj = (space, row, key) => {
    const obj = {
        [Symbol.for('key')]: key
    };
    space.forEach(dim => obj[dim] = row[dim])
    return obj;
}

const getOrCreateObj = (dataMap, space, row) => {
    let obj;
    const key = createKey(space, row);
    if (!dataMap.has(key)) {
        obj = createObj(space, row, key);
        dataMap.set(key, obj);
    } else {
        obj = dataMap.get(key);
    }
    return obj;
}

// outside of function scope, shared by markers
let functions = {
    config: {},
    applyConfig: action(function(config) {
        this.config = deepmerge(this.config, config);
        return this;
    }),
    get space() { return this.config.space },
    get important() { return this.config.important },
    get selected() { return this.config.selected },
    get encoding() {
        const encodingConfig = this.config.encoding;
        const encoding = [];
        Object.keys(encodingConfig).forEach(key => {
            const encodingId = encodingConfig[key];
            if (encodingStore.has(encodingId))
                encoding.push([key, encodingStore.get(encodingId)]);
            else
                throw ("markerStore config: encodingStore does not have encoding with key: " + key);
        });
        return observable.map(encoding);
    },
    get dataMap() {
        let dataMap = new Map();
        let dataSources = new Map();

        // get all datasources used by marker
        for (let [prop, { _data, which }] of this.encoding) {
            if (!this.space.includes(which)) {
                if (dataSources.has(_data))
                    dataSources.get(_data).push({ which, prop });
                else
                    dataSources.set(_data, [{ which, prop }]);
            }
        }

        // save relevant data to dataMap
        for (let [data, encodings] of dataSources) {
            data.forEach(row => {
                const obj = getOrCreateObj(dataMap, this.space, row);
                encodings.forEach(({ prop, which }) => {
                    obj[prop] = row[which];
                })
            })
        }

        return dataMap;
    },
    get frameMap() {
        const frameMap = this.encoding.get("frame").createFrameMap(this.dataMap, this.space);
        for (let [frameId, dataMap] of frameMap) {
            this.checkImportantEncodings(dataMap);
        }
        return frameMap;
    },
    get data() {
        // return a frame if there is one
        if (this.encoding.has("frame")) {
            const currentFrameId = this.encoding.get("frame").value;
            if (this.frameMap.has(currentFrameId))
                return [...this.frameMap.get(currentFrameId).values()];
            if (currentFrameId != null)
                return new Map();
        }
        // otherwise, just return data
        return [...this.checkImportantEncodings(this.dataMap).values()];
    },
    checkImportantEncodings: function(dataMap) {
        // remove markers which miss important values. Should only be done áfter interpolation though.
        for (let [key, row] of dataMap)
            if (this.important.some(prop => !row.hasOwnProperty(prop) || !row[prop])) dataMap.delete(key);
        return dataMap;
    }
}

export function baseMarker(config) {

    config = deepmerge({
        space: ["entity", "time"],
        important: [],
        selected: [],
        encoding: {}
    }, config);

    // create object
    return assign({}, functions).applyConfig(config);
}

export default function marker_observable(config) {
    // create observable out of it
    return observable(baseMarker(config));
}