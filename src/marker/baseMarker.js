import { trace, computed, observable, toJS } from 'mobx';
import { encodingStore } from '../encoding/encodingStore'
import { dataSourceStore } from '../dataSource/dataSourceStore'
import { dataConfigStore } from '../dataConfig/dataConfigStore'
import { assign, applyDefaults, intersect } from "../utils";
import { configurable } from '../configurable';
import { fromPromise } from 'mobx-utils'
import { resolveRef } from '../vizabi';
import { dataConfig } from '../dataConfig/dataConfig';
import { fullJoin } from '../dataFrame';

const defaultConfig = {
    important: [],
    encoding: {},
};

// outside of function scope, shared by markers
let functions = {
    get data() {
        return dataConfigStore.getByDefinition(this.config.data, this)
        
        cfg = resolveRef(cfg);
        return observable(dataConfig(cfg, this));
    },
    get important() { return this.config.important },
    get encoding() {
        trace();
        // TODO: on config.encoding change, new encodings will be created
        // shouldn't happen, only for actual new encodings, new encodings should be created
        // called consolidating in MST 
        // having encoding ids in config can help in consolidating (match ids). maybe other ways possible too
        return encodingStore.getByDefinitions(this.config.encoding);
    },
    get ownDataEncoding() {
        trace();
        return new Map(
            Array.from(this.encoding).filter(([prop, enc]) => enc.data.hasOwnData)
        );
    },
    get dataPromise() {
        return fromPromise(Promise.all([...this.ownDataEncoding.values()].map(enc => enc.data.promise)))
    },
    get metaDataPromise() {
        return fromPromise(Promise.all([
            ...dataSourceStore.getAll().map(ds => ds.metaDataPromise)
        ])); // [...this.ownDataEncoding.values()].map(enc => enc.data.promise)))
    },
    get availability() {
        const items = [];
        dataSourceStore.getAll().forEach(ds => {
            ds.availability.data.forEach(kv => {
                items.push({ key: kv.key, value: ds.getConcept(kv.value), source: ds });
            })
        })
        return items;
    },
    get spaceAvailability() {
        const items = [];
        dataSourceStore.getAll().forEach(ds => {
            ds.availability.keyLookup.forEach((val, key) => {
                items.push(val);
            })
        })
        return items;
    },
    // computed to cache calculation
    get dataMapCache() {
        trace();
        const markerDefiningEncodings = [];
        const markerAmmendingEncodings = [];

        // sort visual encodings if they define or ammend markers
        // define marker if they have own data and have space identical to marker space
        const markerSpaceKey = this.data.space.join('-');
        for (let [prop, encoding] of this.encoding) {

            // selections don't have concept set and are not part of marker data
            // prevents rejoining data on each select/highlight change
            if (!encoding.data.concept)
                continue; 

            const spaceOverlap = intersect(this.data.space, encoding.data.space);
            const spaceOverlapKey = spaceOverlap.join('-');
            const importantDefEnc = this.important.length == 0 || this.important.includes(prop);
            const joinConfig = { 
                projection: { 
                    [encoding.data.concept]: prop
                },
                dataFrame: encoding.data.responseMap
            }

            // important data in marker space defines the actual markers in viz
            // this data is necessary but not sufficient for defining markers
            // encoding in subspace can't be defining because value for one or more dimension(s) is missing. 
            // Superspace is fine.
            if (importantDefEnc && encoding.data.hasOwnData && spaceOverlapKey == markerSpaceKey)
                markerDefiningEncodings.push(joinConfig);
            else
                markerAmmendingEncodings.push(joinConfig);
        }

        // define markers (full join encoding data)
        // TODO: add check for non-marker space dimensions to contain only one value
        // -> save first row values and all next values should be equal to first
        let dataMap = fullJoin(markerDefiningEncodings, this.data.space);
        dataMap = dataMap.leftJoin(markerAmmendingEncodings);

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