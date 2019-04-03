import { trace, computed, observable, toJS, reaction, autorun } from 'mobx';
import { encodingStore } from '../encoding/encodingStore'
import { dataSourceStore } from '../dataSource/dataSourceStore'
import { dataConfigStore } from '../dataConfig/dataConfigStore'
import { assign, applyDefaults, intersect, relativeComplement, arrayEquals, isProperSubset } from "../utils";
import { configurable } from '../configurable';
import { fromPromise } from 'mobx-utils'
import { fullJoin } from '../../dataframe/transforms/fulljoin';

const defaultConfig = {
    important: [],
    data: {
        space: [],
        filter: {}
    },
    encoding: {},
};

// outside of function scope, shared by markers
let functions = {
    on: function(type, fn) {
        if (this.validEventType(type) && typeof fn == "function") {
            const disposer = autorun(this.runOnEvent(type, fn));
            this.eventListeners.get(type).set(fn, disposer);
        }
        return this;
    },
    off: function(type, fn) {
        if (this.validEventType(type) && this.eventListeners.get(type).has(fn)){
            this.eventListeners.get(type).get(fn)();
            this.eventListeners.get(type).delete(fn);
        }
        return this;
    },
    eventTypes: ["fulfilled","pending","rejected"],
    validEventType(type) {
        return this.eventTypes.includes(type);
    },
    runOnEvent(type, fn) {
        return () => {
            if (this.dataPromiseState === type) fn.call(this.config, this.dataArray);
        }
    },
    get eventListeners() {
        return new Map(this.eventTypes.map(evt => [evt, new Map()]));
    },
    get data() {
        return dataConfigStore.getByDefinition(this.config.data, this)
    },
    get important() { return this.config.important },
    get encoding() {
        trace();
        // TODO: on config.encoding change, new encodings will be created
        // shouldn't happen, only for actual new encodings, new encodings should be created
        // called consolidating in MST 
        // having encoding ids in config can help in consolidating (match ids). maybe other ways possible too

        if (Object.keys(this.config.encoding).length > 0)
            return encodingStore.getByDefinitions(this.config.encoding, this);
        
        let defaultEnc, encodingCfg = {};
        if (defaultEnc = this.data.source.defaultEncoding) {
            defaultEnc.forEach(({concept, space }) => { 
                encodingCfg[concept] = {
                    data: {
                        concept, 
                        space,
                        source: this.data.source
                    }
                }
            });
            return encodingStore.getByDefinitions(encodingCfg, this);
        }

        console.warn("No encoding found and marker data source has no default encodings");
    },
    // TODO: encodings should know the property they encode to themselves; not sure how to pass genericly yet 
    getPropForEncoding(encoding) {
        for (let [prop, enc] of this.encoding) {
            if (enc == encoding) return prop;
        }
    },
    get encodingPromises() {
        const p = this.data.source.metaDataPromise.case({
            fulfilled: () => [...this.encoding.values()].map(enc => enc.data.promise),
            pending: () => [],
            rejected: () => []
        })
        fromPromise.all(p);
    },
    get dataPromise() {
        this.data.source.metaDataPromise.case({ rejected: (e) => console.warn(e) });
        if (this.data.source.metaDataState != "fulfilled")
            return fromPromise(new Promise(() => {}));

        const encodingPromises = [...this.encoding.values()].map(enc => enc.data.promise)
        return fromPromise(Promise.all(encodingPromises));
    },
    get dataPromiseState() {
        this.dataPromise.case({ rejected: (e) => console.warn(e) });
        return this.dataPromise.state;
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
        const spaceEncodings = [];
        const constantEncodings = [];

        // sort visual encodings if they define or ammend markers
        // define marker if they have own data and have space identical to marker space
        for (let [prop, encoding] of this.encoding) {

            // no data or constant, no further processing (e.g. selections)
            if (encoding.data.concept == null && !encoding.data.isConstant())
                continue;

            // constants value (ignores other config like concept etc)
            else if (encoding.data.isConstant())
                constantEncodings.push({ prop, encoding });

            // copy data from space/key
            else if (encoding.data.conceptInSpace)
                spaceEncodings.push({ prop, encoding });
            
            // own data, not defining final markers
            else if (isProperSubset(encoding.data.space, this.data.space) || !this.isImportant(prop))
                markerAmmendingEncodings.push(this.joinConfig(encoding, prop));

            // own data, defining real data
            else
                markerDefiningEncodings.push(this.joinConfig(encoding, prop));    

        }

        // define markers (full join encoding data)
        let dataMap = fullJoin(markerDefiningEncodings, this.data.space);
        dataMap = dataMap.leftJoin(markerAmmendingEncodings);
        constantEncodings.forEach(({prop, encoding}) => {
            dataMap = dataMap.addColumn(prop, encoding.data.constant);
        })
        spaceEncodings.forEach(({prop, encoding}) => {
            const concept = encoding.data.concept;
            dataMap = dataMap.addColumn(prop, row => row[concept]);
        });

        // TODO: this should only happen áfter interpolation
        this.checkImportantEncodings(dataMap);

        return dataMap;
    },
    joinConfig(encoding, prop) {
        return { 
            projection: { 
                [encoding.data.concept]: prop
            },
            dataFrame: encoding.data.responseMap
        }
    },
    isImportant(prop) {
        return this.important.length == 0 || this.important.includes(prop)
    },
    get dataMap() {
        //trace();

        const frameEnc = this.encoding.get("frame") || {};
        const frame = frameEnc.currentFrame;
        if (frame) {
            return frame;
        } else {
            const dataMap = this.dataMapCache;
            const orderEnc = this.encoding.get("order");
            return orderEnc ? orderEnc.order(dataMap) : dataMap;
        }
    },
    get dataArray() {
        //trace();
        return [...this.dataMap.values()];
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
    /*
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
    */
}