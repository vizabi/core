import { createMarkerKey } from "../../core/utils";
import { observable } from "mobx";

export function DataFrameStorageMap(data = new Map(), keyArr) {
    const storage = {};
    const map = storage.data = (data instanceof Map) ? data : mapFromObjectIter(data, keyArr);
    storage.fields = Object.keys(data[0] || {});
    storage.has = (keyObj) => map.has(createMarkerKey(keyObj, keyArr));
    storage.get = (keyObj) => map.get(createMarkerKey(keyObj, keyArr));
    storage.hasByObjOrStr = (keyObj, keyStr) => map.has(keyStr);
    storage.getByObjOrStr = (keyObj, keyStr) => map.get(keyStr);
    storage.set = (keyObj, value) => map.set(createMarkerKey(keyObj, keyArr), value);
    storage.setByKeyStr = (keyStr, value) => map.set(keyStr, value);
    storage.keys = map.keys.bind(map);
    storage.values = map.values.bind(map);
    storage.delete = map.delete.bind(map);
    storage[Symbol.iterator] = map[Symbol.iterator].bind(map);

    return storage;
}

function mapFromObjectIter(objectIter, key) {
    const map = new Map();
    const duplicates = [];

    if (objectIter.hasByObjOrStr)
        objectIter = objectIter.values();

    const emptyKey = key.length == 0;
    const keyFn = emptyKey ? rangeIndex(0) : createMarkerKey;

    for (let row of objectIter) {
        const keyStr = keyFn(row, key);
        row[Symbol.for('key')] = keyStr;
        if (map.has(keyStr))
            duplicates.push({ keyStr, orig: map.get(keyStr), new: row})
        map.set(keyStr, row);
    }

    if (duplicates.length > 0)
        console.warn('Found duplicates for given key when constructing dataframe.', { key, duplicates });

    return map;
}

function rangeIndex(start, end) {
    const gen = range(start, end);
    return (row, key) => {
        return gen.next().value;
    }
}

function* range(start, end = Infinity) {
    for (let i=start; i<end; i++) {
        yield i;
    }
}