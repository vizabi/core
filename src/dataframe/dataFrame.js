import { createMarkerKey, normalizeKey, arrayEquals } from "../core/utils";

//df.get(["swe","2015"]).population

function DataFrameStorageMap(data = new Map(), keyArr) {
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

/**
 * Virtual data frame storage based on lookups. A row is constructed on request from lookups for each dimension of requested key.
 * @param {*} concepts Map of concepts. Each concept is a map of dimensions. Each dimension is a map of values on that dimension. E.g. name=>geo=>swe=>Sweden
 */
function DataFrameStorageLookups(concepts, keyArr) {
    const storage = {};
    storage.data = concepts;
    storage.has = (keyObj) => {
        // true if there is at least one concept which has a lookup for every dimension in key
        // i.e. a row can be returned for this key
        return true; //[...concepts.values()].some(lookups => keyArr.every(dim => dim in keyObj && lookups.has(dim)));
    }
    storage.get = (keyObj) => {
        const row = {};
        concepts.forEach((lookups, concept) => {
            const entityProps = {};
            keyArr.forEach(dim => {
                if (lookups.has(dim))
                    entityProps[dim] = lookups.get(dim).get(keyObj[dim]);
                else
                    entityProps[dim] = keyObj[dim];
            });
            row[concept] = entityProps;
        });
        return row;
    }
    storage.hasByObjOrStr = (keyObj, keyStr) => storage.has(keyObj);
    storage.getByObjOrStr = (keyObj, keyStr) => storage.get(keyObj);
    storage.set = (keyObj, value) => { 
        console.warn("Invalid operation. Generated dataframe does not support .set().")
    }
    storage.values = () => { console.warn("Generated dataframe .values() not implemented yet")};
    storage.delete = () => { console.warn("Invalid operation. Generated dataframe does not support .delete()")};
    storage[Symbol.iterator] = function* generate() {
        console.warn("Invalid operation. Generated dataframe iterator not yet implemented.");
    } 
    return storage;
}

export const DataFrame = (data = [], key = []) => constructDataFrame(data, key, DataFrameStorageMap);
DataFrame.fromLookups = (concepts, key) => constructDataFrame(concepts, key, DataFrameStorageLookups);
DataFrame.fromArray = DataFrame;

function constructDataFrame(data, key, storageBuilderFn) {
    const df = {};

    df.key = normalizeKey(key);
    df.data = storageBuilderFn(data, df.key);
    attachMethods(df);

    return df;
}

function attachMethods(df) {
    df.order = (direction) => order(df, direction); 
    df.leftJoin = (rightJoinParams) => leftJoin({ dataFrame: df }, rightJoinParams);
    df.fullJoin = (joinParams, key) => fullJoin([{ dataFrame: df }, ...joinParams], key);
    df.copyColumn = (src, dest) => copyColumn(df, src, dest);
    df.has = df.data.has;
    df.get = df.data.get;
    df.hasByObjOrStr = df.data.hasByObjOrStr;
    df.getByObjOrStr = df.data.getByObjOrStr;
    df.set = df.data.set;
    df.setByKeyStr = df.data.setByKeyStr;
    df.values = df.data.values;
    df.delete = df.data.delete;
    df[Symbol.iterator] = df.data[Symbol.iterator];
}

export function mapFromObjectArray(objectArray, key) {
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

export function order(df, direction, orderField = 'order') {
    const data = Array.from(df.data);

    data.sort((a, b) => {
        let ao = a[1][orderField],
            bo = b[1][orderField];

        return direction == directions.ascending ?
            ao - bo :
            bo - ao;
    });

    return DataFrame(data, df.key);
}

export function copyColumn(df, srcCol, newCol) {
    for (let row of df.values()) {
        row[newCol] = row[srcCol];
    }
    return df;
}

/**
 * Join right on left with overlapping columns of key as join columns.
 * @param {*} left 
 * @param  {...any} rights 
 */
export function leftJoin(left, rights) {

    const leftDf = left.dataFrame;
    const leftKey = leftDf.key;
    
    const rightCopies = rights.filter(r => leftKey.some(d => d in r.projection));
    rights = rights.filter(r => r.dataFrame !== leftDf).map(r => { 
        const sameKey = arrayEquals(r.dataFrame.key, leftKey);
        r.hasFn = sameKey ? "hasByObjOrStr" : "has";
        r.getFn = sameKey ? "getByObjOrStr" : "get";
        return r;
    });

    const result = DataFrame([], leftKey)

    for (let [keyStr, row] of leftDf) {
        // left row as base
        const leftRow = cloneRow(row);
        
        // join any rows in right dfs which have same key as left row
        for (let { dataFrame, projection, hasFn, getFn } of rights) {
            if (dataFrame[hasFn](row, keyStr)) {
                const rightRow = dataFrame[getFn](row, keyStr);
                for(let key in projection) {
                    leftRow[projection[key]] = rightRow[key];
                }
            }
        }
        
        // set row
        result.setByKeyStr(keyStr, leftRow);
    }
    for (let right of rightCopies) {
        for (let col in right.projection) {
            copyColumn(result, col, right.projection[col]); 
        }   
    }

    return result;
}

export function fullJoin(joinParams, joinKey = joinParams[0].dataFrame.key) {

    return joinParams.reduce(_fullJoin, DataFrame([], joinKey));

}

/**
 * Full join. Impure: Modifies left df. Left key is join key. Right key must contain all join key fields (can't use regular fields for joining).
 * @param {DataFrame} left DataFrame used as base for join
 * @param {*} rightCfg { dataFrame: DataFrame, projection: { origField: projField } }
 */
function _fullJoin(left, rightCfg) {
    // join or copy right rows onto result
    const joinKey = left.key;
    const dataKey = rightCfg.dataFrame.key;
    const projection = rightCfg.projection || {};

    if (!joinKey.every(dim => dataKey.includes(dim)))
        console.warn("Right key does not contain all join fields.", { left: left, right: rightCfg });
    if (!projection || Object.keys(projection).length === 0)
        console.warn("No projection given for join so no new fields will be joined", { left: left, right: rightCfg } );

    for (let [keyStr, rightRow] of rightCfg.dataFrame) {
        const leftRow = getOrCreateRow(left, joinKey, rightRow, keyStr)  
        // project with aliases        
        for(let key in projection) {
            leftRow[projection[key]] = rightRow[key];
        }
    }

    return left;
}

function createObj(space, row, keyStr) {
    const obj = {
        [Symbol.for('key')]: keyStr
    };
    space.forEach(dim => obj[dim] = row[dim])
    return obj;
}

function getOrCreateRow(df, keyArr, row, keyStr) {
    let obj;
    // if (keyStr == undefined) keyStr = createMarkerKey(row, keyArr);
    if (!df.hasByObjOrStr(row, keyStr)) {
        obj = createObj(keyArr, row, keyStr);
        df.setByKeyStr(keyStr, obj);
    } else {
        obj = df.getByObjOrStr(row, keyStr);
    }
    return obj;
}

function joinRows(...rows) {
    return Object.assign(...rows);
}
function cloneRow(row) {
    return joinRows({}, row);
}