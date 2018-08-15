import { trace, computed } from 'mobx';
import { encodingStore } from '../encoding/encodingStore'
import { dataSourceStore } from '../dataSource/dataSourceStore'
import { assign, createMarkerKey, deepmerge, isString } from "../utils";
import { configurable } from '../configurable';
import { PENDING, FULFILLED, REJECTED, fromPromise } from 'mobx-utils'

const createObj = (space, row, key) => {
    const obj = {
        [Symbol.for('key')]: key
    };
    space.forEach(dim => obj[dim] = row[dim])
    return obj;
}

const getOrCreateObj = (dataMap, space, row) => {
    let obj;
    const key = createMarkerKey(space, row);
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
    encoding: {},
};

// outside of function scope, shared by markers
let functions = {
    get space() { return this.config.space },
    get important() { return this.config.important },
    get encoding() {
        //trace();
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
    get ownDataEncoding() {
        //trace();
        return new Map(
            Array.from(this.encoding).filter(([prop, enc]) => enc.data.hasOwnData)
        );
    },
    get readyPromise() {
        return this.dataPromises;
    },
    get availabilityPromise() {
        return fromPromise(Promise.all(dataSourceStore.getAll().map(ds => ds.availabilityPromise)))
    },
    get conceptsPromise() {
        return fromPromise(Promise.all(dataSourceStore.getAll().map(ds => ds.conceptsPromise)))
    },
    get dataPromise() {
        return fromPromise(Promise.all([...this.ownDataEncoding.values()].map(enc => enc.data.promise)))
    },
    get availability() {
        const items = [];
        dataSourceStore.getAll().forEach(ds => {
            ds.availability.data.forEach(kv => {
                items.push({ key: kv.key, value: ds.getConcept(kv.value) });
            })
        })
        return items;
    },
    // computed to cache calculation
    get dataMapCache() {
        //trace();
        const dataMap = new Map();
        const lookups = new Map();
        const spaces = new Map();

        // TODO: move this to generic data merge to data transformation layer

        // sort visual encodings by space: marker space and (strict) subspaces
        for (let [prop, encoding] of this.ownDataEncoding) {
            if (prop == "label") continue;
            const spaceOverlap = intersect(this.space, encoding.data.space);
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
        if (spaces.has(markerSpaceKey))
            for (let { prop, encoding }
                of spaces.get(markerSpaceKey)) {
                encoding.data.response.forEach(row => {
                    const obj = getOrCreateObj(dataMap, this.space, row);
                    obj[prop] = encoding.processRow(row);
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
                encoding.data.response.forEach(row => {
                    const obj = getOrCreateObj(lookup, space, row);
                    obj[prop] = encoding.processRow(row);
                });
            }
            lookups.set(space, lookup);
        }

        // merge subspace data onto markers, using subspace lookups
        for (let row of dataMap.values()) {
            for (let [space, lookup] of lookups) {
                const key = createMarkerKey(space, row);
                // will not copy key-Symbol as it's not enumerable
                // speed comparison: https://jsperf.com/shallow-merge-options/
                const source = lookup.get(key);
                for (var i in source) {
                    row[i] = source[i];
                }
            }
        }

        if (this.encoding.has('label'))
            this.encoding.get('label').data.addLabels(dataMap, 'label');

        // intersect of two arrays (representing sets)
        function intersect(a, b) {
            return a.filter(e => b.includes(e));
        }

        this.checkImportantEncodings(dataMap);

        return dataMap;
    },
    get dataMap() {
        //trace();

        const frameEnc = this.encoding.get("frame") || {};
        const frame = frameEnc.currentFrame;
        const dataMap = frame ? frame : this.dataMapCache;

        const orderEnc = this.encoding.get("order");
        return orderEnc ? orderEnc.order(dataMap) : dataMap;
    },
    get data() {
        //trace();

        let data;
        if (this.encoding.has('frame')) {
            const frameEnc = this.encoding.get("frame") || {};
            data = frameEnc.currentFrameArray;
        }
        data = data ? data : this.dataMap ? [...this.dataMap.values()] : null;

        return data;
    },
    checkImportantEncodings: function(dataMap) {
        // remove markers which miss important values. Should only be done áfter interpolation though.
        const important = this.important;
        for (let [key, row] of dataMap)
            if (important.some(prop => !row.hasOwnProperty(prop) || !row[prop])) dataMap.delete(key);
    }
}

export function baseMarker(config) {
    config = deepmerge.all([{}, defaultConfig, config]);
    return assign({}, functions, configurable, { config });
}

baseMarker.decorate = {
    ownDataEncoding: computed({
        equals(a, b) {
            let l = a.size;
            if (l != b.size) return false;
            let aKeys = a.keys();
            for (let i = 0; i < l; i++) {
                let key = aKeys[i];
                if (!b.has(key)) return false;
                if (!a.get(key) === b.get(key)) return false;
            }
            return true;
        }
    })
}