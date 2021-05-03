import { normalizeKey, getIter, rangeIndex, createKeyFn, isNonNullObject } from "../dfutils";

export function MapStorage(data = [], keyArr = data.key || []) {
    
    const storage = createEmptyMap();
    storage.key = keyArr;
    storage.batchSet(data);

    return storage;
}

function createEmptyMap() {
    const storage = new Map();
    let key = [];

    // local references to functions which will be decorated
    const has = storage.has.bind(storage);
    const get = storage.get.bind(storage);
    const set = storage.set.bind(storage);

    Object.defineProperty(storage, 'fields', { 
        get: () => Object.keys(storage.values().next().value) || []
    });  
    storage.setKey = newKey => {
        key = normalizeKey(newKey);
        storage.incrementIndex = storage.key.length === 0; 
        storage.keyFn = storage.incrementIndex ? () => storage.size : createKeyFn(storage.key);
        storage.updateIndexes();
    }
    Object.defineProperty(storage, 'key', { 
        set: storage.setKey,
        get: () => key
    });    
    storage.has = keyObj => storage.incrementIndex ? has(keyObj) : has(storage.keyFn(keyObj));
    storage.get = keyObj => {
        if (!storage.incrementIndex && !isNonNullObject(keyObj))
            throw(new Error('Dataframe key is not an object: ' + JSON.stringify(keyObj)))
        const key = storage.incrementIndex ? keyObj : storage.keyFn(keyObj)
        //if (!has(key))
        //    throw(new Error('Key not found in dataframe: ' + JSON.stringify(keyObj)))
        return get(key);
    }
    storage.set = (row, keyStr) => {
        // passing keyStr is optimization to circumvent keyStr generation (TODO: check performance impact)
        // if keyStr set, we assume it's correct. Only use when you know keyStr fits with current key dims
        if (keyStr === undefined || storage.incrementIndex) {
            keyStr = storage.keyFn(row);
            row[Symbol.for('key')] = keyStr;
        }
        set(keyStr, row);
    }
    storage.hasByObjOrStr = (keyObj, keyStr) => has(keyStr);
    storage.getByObjOrStr = (keyObj, keyStr) => get(keyStr);
    storage.batchSet = rowIter => batchSet(storage, rowIter);
    storage.rows = storage.values;
    storage.updateIndexes = () => updateIndexes(storage);

    storage.setKey([]);
    return storage;
}

function batchSet(storage, rowIter) {
    const duplicates = [];

    rowIter = getIter(rowIter);

    let keyStr;
    for (let row of rowIter) {
        if (!storage.incrementIndex) {
            keyStr = storage.keyFn(row);
            if (storage.hasByObjOrStr(null, keyStr))
                duplicates.push({ keyStr, orig: storage.getByObjOrStr(null, keyStr), new: row})
            storage.set(row, keyStr);
        } else {
            storage.set(row);
        }
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