
import { DataFrame } from "./dataFrame";
import { arrayEquals, createMarkerKey, pick, parseMarkerKey } from "../core/utils";
import { interpolate } from "./transforms/interpolate";
import { order } from "./transforms/order";
import { reindex } from "./transforms/reindex";
import { filter } from "./transforms/filter";


export function DataFrameGroup(df, groupKey, rowKey = df.key) {

    if (Array.isArray(df))
        df = DataFrame(df, rowKey);

    if (!Array.isArray(groupKey)) 
        groupKey = [groupKey];

    const groupMap = new Map();

    const diffKey = !arrayEquals(df.key, rowKey);

    const groupCreate = () => DataFrame([], rowKey);
    const duplicates = [];
    
    const emptyKey = rowKey.length == 0;
    const rowKeyFn = emptyKey ? rangeIndex(0) : createMarkerKey;
    for (let [rowKeyStr, row] of df) {
        const group = getOrCreateGroup(groupMap, groupKey, row, groupCreate);
        if (diffKey) {
            rowKeyStr = rowKeyFn(row, rowKey)
            row[Symbol.for('key')] = rowKeyStr;
        }             
        if (group.hasByObjOrStr(null, rowKeyStr))
            duplicates.push({ rowKeyStr, old: group.getByObjOrStr(null, rowKeyStr), new: row})                                  
        group.setByKeyStr(rowKeyStr, row);
    }
    
    if (duplicates.length > 0)
        console.warn('Found duplicate row keys when grouping dataframe. Please change groupKey and/or rowKey so row keys are unique.', { groupKey, rowKey, duplicates });

    return createGroupingObj(groupMap, df)
}

function createGroupingObj(groupMap, df) {
    const grouping = {}
    grouping.groupMap = groupMap;
    grouping.each = (fn) => each(grouping, fn);
    grouping.interpolate = map(grouping, interpolate);
    grouping.filter = map(grouping, filter);
    grouping.order = map(grouping, order);
    grouping.reindex = map(grouping, reindex);
    grouping.flatten = (key=df.key) => flatten(grouping, key);
    grouping[Symbol.iterator] = groupMap[Symbol.iterator].bind(groupMap);
    grouping.has = groupMap.has.bind(groupMap);
    grouping.set = groupMap.set.bind(groupMap);
    grouping.get = groupMap.get.bind(groupMap);
    grouping.keys = groupMap.keys.bind(groupMap);
    grouping.values = groupMap.values.bind(groupMap);
    return grouping;
}

function each(grouping, fn) {
    for (let [key, df] of grouping) {
        fn(df, parseMarkerKey(key));
    }
    return grouping;
}

function map(grouping, fn) {
    return function() {
        for (let [key, df] of grouping) {
            grouping.set(key, fn(df, ...arguments));
        }
        return grouping;
    }
}

/**
 * 
 * @param {*} groups collection of groups
 * @param {*} groupByKey
 * @param {*} createGroup 
 */
function getOrCreateGroup(groups, groupKeyDims, row, createGroup) {
    const groupKeyStr = createMarkerKey(row, groupKeyDims);
    if (groups.has(groupKeyStr)) {
        return groups.get(groupKeyStr);
    } else {
        const group = createGroup();
        group.groupKey = pick(row, groupKeyDims);
        groups.set(groupKeyStr, group);
        return group;
    }
}

function flatten(grouping, key = []) {
    function* entries() {
        for (let df of grouping.groupMap.values()) {
            for (let row of df.values()) {
                yield row;
            }
        }
    }
    return DataFrame(entries(), key);
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