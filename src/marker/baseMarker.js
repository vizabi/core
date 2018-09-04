import { trace, computed, observable, toJS } from 'mobx';
import { encodingStore } from '../encoding/encodingStore'
import { dataSourceStore } from '../dataSource/dataSourceStore'
import { assign, createMarkerKey, applyDefaults, isString, intersect } from "../utils";
import { configurable } from '../configurable';
import { fromPromise } from 'mobx-utils'
import { resolveRef } from '../vizabi';
import { dataConfig } from '../dataConfig/dataConfig';

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
    get data() {
        var cfg = this.config.data;
        cfg = resolveRef(cfg);

        return observable(dataConfig(cfg, this));
    },
    get important() { return this.config.important },
    get encoding() {
        //trace();
        // TODO: on config.encoding change, new encodings will be created
        // shouldn't happen, only for actual new encodings, new encodings should be created
        // called consolidating in MST 
        return encodingStore.getByDefinitions(this.config.encoding);
    },
    get ownDataEncoding() {
        //trace();
        return new Map(
            Array.from(this.encoding).filter(([prop, enc]) => enc.hasOwnData)
        );
    },
    get notOwnDataEncoding() {
        return new Map(
            Array.from(this.encoding).filter(([prop, enc]) => !enc.hasOwnData)
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
        const markerDefiningEncodings = [];
        const markerAmmendingEncodings = [];

        // TODO: 
        // - move this to generic data merge to data transformation layer
        // - no special case for label

        // sort visual encodings if they define or ammend markers
        // define marker if they have own data and have space identical to marker space
        const markerSpaceKey = this.data.space.join('-');
        for (let [prop, encoding] of this.encoding) {
            const spaceOverlap = intersect(this.data.space, encoding.data.space);
            const spaceOverlapKey = spaceOverlap.join('-');
            const importantDefEnc = this.important.length == 0 || this.important.includes(prop);
            // important data in marker space defines the actual markers in viz
            // this data is necessary but not sufficient for defining markers
            // data available in all important encodings is sufficient, this is checked later in checkImportantEncodings()
            if (encoding.hasOwnData && importantDefEnc && spaceOverlapKey == markerSpaceKey)
                markerDefiningEncodings.push({ prop, encoding });
            else
                markerAmmendingEncodings.push({ prop, encoding });
        }

        // define markers (full join encoding data)
        // TODO: add check for non-marker space dimensions to contain only one value
        // -> save first row values and all next values should be equal to first
        const plainSpace = toJS(this.data.space); // no mobx overhead
        for (let { prop, encoding }
            of markerDefiningEncodings) {
            const processFn = encoding.processRow.bind(encoding); // no mobx overhead
            // old school for loop fastest
            const response = encoding.data.response;
            const n = response.length;
            for (let i = 0; i < n; i++) {
                let row = response[i];
                const obj = getOrCreateObj(dataMap, plainSpace, row);
                obj[prop] = processFn(row);
            };
        }

        // ammend markers (left join encoding data)
        for (let { prop, encoding }
            of markerAmmendingEncodings) {
            encoding.addPropertyToDataMap(dataMap, prop);
        }

        // TODO: this should only happen áfter interpolation
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
    get dataArray() {
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
    applyDefaults(config, defaultConfig);
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