import { normalizeKey, getIter, rangeIndex, createKeyFn } from "../dfutils";

export function MapStorage(data = [], keyArr = data.key || []) {
    
    const storage = createEmptyMap();
    storage.key = keyArr;
    storage.batchSet(data);

    return storage;
}

function createEmptyMap() {
    const storage = new Map();
    let key = [], isRangeKey;

    // local references to functions which will be decorated
    const has = storage.has.bind(storage);
    const get = storage.get.bind(storage);
    const set = storage.set.bind(storage);

    storage.fields = new Set();
    storage.keyFn = rangeIndex(0);
    storage.setKey = newKey => {
        key.forEach(e => storage.fields.delete(e)); 
        key = normalizeKey(newKey);
        key.forEach(e => storage.fields.add(e)); 
        isRangeKey = key.length === 0; 
        storage.keyFn = isRangeKey ? rangeIndex(0) : createKeyFn(storage.key);
        storage.updateIndexes(storage);
    }
    Object.defineProperty(storage, 'key', { 
        set: storage.setKey,
        get: () => key
    });
    storage.has = keyObj => isRangeKey ? false     : has(storage.keyFn(keyObj));
    storage.get = keyObj => isRangeKey ? undefined : get(storage.keyFn(keyObj));
    storage.set = (row, keyStr) => {
        // passing keyStr is optimization to circumvent keyStr generation (TODO: check performance impact)
        // if keyStr set, we assume it's correct. Only use when you know keyStr fits with current key dims
        if (keyStr === undefined || isRangeKey)
            keyStr = storage.keyFn(row, key);
        checkFields(storage.fields, row);
        row[Symbol.for('key')] = keyStr;
        set(keyStr, row);
    }
    storage.hasByObjOrStr = (keyObj, keyStr) => has(keyStr);
    storage.getByObjOrStr = (keyObj, keyStr) => get(keyStr);
    storage.batchSet = rowIter => batchSet(storage, rowIter);
    storage.rows = storage.values;
    storage.updateIndexes = () => updateIndexes(storage);
    return storage;
}

function checkFields(fields, row) {
    for (let field in row) {
        if (!fields.has(field)) {
            fields.add(field);
        }
    }
}

function batchSet(storage, rowIter) {
    const duplicates = [];

    rowIter = getIter(rowIter);

    let keyStr;
    for (let row of rowIter) {
        keyStr = storage.keyFn(row);
        if (storage.hasByObjOrStr(null, keyStr))
            duplicates.push({ keyStr, orig: storage.getByObjOrStr(null, keyStr), new: row})
        storage.set(row, keyStr);
    }

    if (duplicates.length > 0)
        console.warn('Found duplicates for given key when constructing dataframe.', { key: storage.key, duplicates });
}

function updateIndexes(storage) {
    for (let [key, row] of storage) {
        storage.delete(key);
        // set won't overwrite any not-yet-deleted keys 
        // because key dims are either different 
        // or if they're identical, we just removed the key it would overwrite
        storage.set(row); 
    }
}