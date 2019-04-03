
import { DataFrame } from "./dataFrame";
import { relativeComplement, arrayEquals, createMarkerKey } from "../core/utils";
import { interpolate } from "./transforms/interpolate";
import { order } from "./transforms/order";
import { reindex } from "./transforms/reindex";


export function DataFrameGroup(df, groupKey, rowKey = df.key) {

    if (!Array.isArray(groupKey)) 
        groupKey = [groupKey];

    const groupMap = new Map();

    const diffKey = !arrayEquals(df.key, rowKey);

    const groupCreate = () => DataFrame([], rowKey);
    const duplicates = [];
    
    const emptyKey = rowKey.length == 0;
    const rowKeyFn = emptyKey ? rangeIndex(0) : createMarkerKey;
    for (let [rowKeyStr, row] of df) {
        const groupKeyStr = createMarkerKey(row, groupKey);
        const group = getOrCreateGroup(groupMap, groupKeyStr, groupCreate);
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
    grouping.interpolate = map(grouping, interpolate);
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
function getOrCreateGroup(groups, groupByKey, createGroup) {
    if (groups.has(groupByKey)) {
        return groups.get(groupByKey);
    } else {
        const group = createGroup();
        groups.set(groupByKey, group);
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