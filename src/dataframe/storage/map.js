import { createMarkerKey } from "../../core/utils";

export function DataFrameStorageMap(data = new Map(), keyArr) {
    const storage = {};
    const map = storage.data = (data instanceof Map) ? data : mapFromObjectArray(data, keyArr);
    storage.has = (keyObj) => map.has(createMarkerKey(keyObj, keyArr));
    storage.get = (keyObj) => map.get(createMarkerKey(keyObj, keyArr));
    storage.hasByObjOrStr = (keyObj, keyStr) => map.has(keyStr);
    storage.getByObjOrStr = (keyObj, keyStr) => map.get(keyStr);
    storage.set = (keyObj, value) => map.set(createMarkerKey(keyObj, keyArr), value);
    storage.setByKeyStr = (keyStr, value) => map.set(keyStr, value);
    storage.values = map.values.bind(map);
    storage.delete = map.delete.bind(map);
    storage[Symbol.iterator] = map[Symbol.iterator].bind(map);

    return storage;
}

function mapFromObjectArray(objectArray, key) {
    const map = new Map();
    const duplicates = [];
    for (let row of objectArray) {
        const keyStr = createMarkerKey(row, key);
        row[Symbol.for('key')] = keyStr;
        if (map.has(keyStr))
            duplicates.push({ keyStr, orig: map.get(keyStr), new: row})
        map.set(keyStr, row);
    }
    if (duplicates.length > 0)
        console.warn('Frame already contains row for key: ', duplicates);
    return map;
}