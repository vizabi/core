import { action } from 'mobx';
import { encodingStore } from '../encoding/encodingStore'
import { assign, createKey, deepmerge, isString } from "../utils";
import { configurable } from '../configurable';

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

const defaultConfig = {
    space: ["entity", "time"],
    important: [],
    selections: {},
    encoding: {}
};

// outside of function scope, shared by markers
let functions = {
    get space() { return this.config.space },
    get important() { return this.config.important },
    // TODO: create selections class. Possibly close to datasource for use in same situations
    get selections() {
        return selectionStore.getByDefinitions(this.config.selections);
    },
    get encoding() {
        // TODO: on config.encoding change, new encodings will be created
        // shouldn't happen, only for actual new encodings, new encodings should be created
        return encodingStore.getByDefinitions(this.config.encoding);
    },
    get encodingWhich() {
        return [...this.encoding.values()].map(enc => ({
            which: enc.which,
            space: enc.space || this.space,
            dataSource: enc.dataSource
        }));
    },
    get ddfqlQuery() {
        return {
            select: {
                key: this.space,
                value: this.encodingWhich
            }
        }
    },
    get dataMap() {
        const dataMap = new Map();
        const lookups = new Map();
        const spaces = new Map();

        // TODO: move this to generic data merge to space transformation

        // sort visual encodings by space: marker space and (strict) subspaces
        for (let [prop, encoding] of this.encoding) {
            if (encoding.data == null) return null;
            const spaceOverlap = intersect(this.space, encoding.space);
            const spaceOverlapKey = spaceOverlap.join('-');
            if (spaces.has(spaceOverlapKey))
                spaces.get(spaceOverlapKey).push({ prop, encoding });
            else
                spaces.set(spaceOverlapKey, [{ prop, encoding }]);
        }

        // data in marker space defines the actual markers in viz
        // TODO: add check for non-marker space dimensions to contain only one value
        // -> save first row values and all next values should be equal to first
        const markerSpaceKey = this.space.join('-');
        for (let { prop, encoding }
            of spaces.get(markerSpaceKey)) {
            const which = encoding.which;
            encoding.data.forEach(row => {
                const obj = getOrCreateObj(dataMap, this.space, row);
                obj[prop] = row[which];
            });
        }

        // create lookups for data in subspaces of marker
        for (let [spaceKey, encodings] of spaces) {
            if (spaceKey == markerSpaceKey)
                continue;
            const space = spaceKey.split('-');
            const lookup = new Map();
            for (let { prop, encoding }
                of encodings) {
                const which = encoding.which;
                encoding.data.forEach(row => {
                    const obj = getOrCreateObj(lookup, space, row);
                    obj[prop] = row[which];
                });
            }
            lookups.set(space, lookup);
        }

        // merge subspace data onto markers, using subspace lookups
        for (let row of dataMap.values()) {
            for (let [space, lookup] of lookups) {
                const key = createKey(space, row);
                // will not copy key-Symbol as it's not enumerable
                // speed comparison: https://jsperf.com/shallow-merge-options/
                const source = lookup.get(key);
                for (var i in source) {
                    row[i] = source[i];
                }
            }
        }

        // intersect of two arrays (representing sets)
        function intersect(a, b) {
            return a.filter(e => b.includes(e));
        }

        return dataMap;
    },
    get frameMap() {
        // loading
        if (this.dataMap == null) return null;

        const frameMap = this.encoding.get("frame").createFrameMap(this.dataMap, this.space);
        for (let [frameId, dataMap] of frameMap) {
            this.checkImportantEncodings(dataMap);
        }
        return frameMap;
    },
    get data() {
        // loading
        if (this.dataMap == null) return null;

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
    config = deepmerge.all([{}, defaultConfig, config]);
    return assign({}, functions, configurable, { config });
}