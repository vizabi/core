import { DataFrame } from "./dataFrame";
import { parseMarkerKey, isDataFrame, createKeyFn } from "./utils";
import { interpolate } from "./transforms/interpolate";
import { order } from "./transforms/order";
import { reindex } from "./transforms/reindex";
import { filter } from "./transforms/filter";

/**
 * 
 * @param {*} df DataFrame from which to create groups
 * @param {*} key key by which is grouped
 * @param {*} descKeys keys of groups and their descendants
 */
export function DataFrameGroupMap(df, key, descKeys = []) {

    if (!Array.isArray(descKeys)) descKeys = [[descKeys]]; // desc keys is single string (e.g. 'year')
    if (!Array.isArray(descKeys[0])) descKeys = [descKeys]; // desc keys is one key (e.g. ['year'])
    if (!Array.isArray(key)) key = [key]; // key is single string (e.g. 'year')
    if (!isDataFrame(df)) df = DataFrame(df);
    if (descKeys.length === 0) descKeys = [df.key];  // descKeys is empty
    
    const groupMap = createGroupMap(key, descKeys, df)

    for (let row of df.values()) {
        groupMap.setRow(row);
    }

    return groupMap; 
}

function createGroupMap(key, descendantKeys) {
    const groupMap = new Map();
    groupMap.key = key;
    groupMap.keyFn = createKeyFn(key);
    groupMap.descendantKeys = descendantKeys;
    groupMap.groupType = () => groupMap.descendantKeys.length === 1 ? 'DataFrame' : 'GroupMap';
    groupMap.each = (fn) => each(groupMap, fn);
    groupMap.map = (fn) => map(groupMap, fn);
    // groupMap.mapCall = (fn) => mapCall(groupMap, fn); // not exposing mapcall
    groupMap.interpolate = mapCall(groupMap, "interpolate");
    groupMap.filter = mapCall(groupMap, "filter");
    groupMap.order = mapCall(groupMap, "order");
    groupMap.reindex = mapCall(groupMap, "reindex");
    groupMap.flatten = (key) => flatten(groupMap, key);
    groupMap.groupBy = (key) => {
        for (let group of groupMap.values()) {
            const newGroup = group.groupBy(key);

            // groups change from DataFrame to GroupMap
            if (groupMap.groupType() === 'DataFrame')
                groupMap.set(key, newGroup);
        }
        groupMap.descendantKeys.push(key);
        return groupMap;
    }
    groupMap.createChild = (keyStr) => createChild(groupMap, keyStr);
    groupMap.toJSON = () => mapToObject(groupMap);
    groupMap.rows = function* () {
        let group, row; 
        for (group of groupMap.values()) {
            for (row of group.rows()) // get rows recursively
                yield row;
        }
    }
    groupMap.filterGroups = (filterFn) => {
        let result = DataFrameGroupMap([], groupMap.key, groupMap.descendantKeys);
        for (let [key, group] of groupMap) {
            const newGroup = group.filterGroups(filterFn);
            if (filterFn(newGroup)) 
                result.set(key, newGroup);
        }
        return result;
    }
    groupMap.setRow = (row) => {
        getOrCreateGroup(groupMap, row)
            .setRow(row);
    }
    return groupMap;
}

function each(grouping, fn) {
    for (let [key, df] of grouping) {
        fn(df, parseMarkerKey(key));
    }
    return grouping;
}

function map(grouping, fn) {
    for (let [key, df] of grouping) {
        grouping.set(key, fn(df, parseMarkerKey(key)));
    }
    return grouping;
}

function mapCall(groupMap, fnName) {
    return function() {
        let result = DataFrameGroupMap([], groupMap.key, groupMap.descendantKeys);
        for (let [key, group] of groupMap) {
            result.set(key, group[fnName](...arguments));
        }
        return result;
    }
}

/**
 * 
 * @param {*} group the group to find member in
 * @param {*} row data row to find member for
 */
function getOrCreateGroup(groupMap, row) {
    let group;
    const keyStr = groupMap.keyFn(row);
    if (groupMap.has(keyStr)) {
        group = groupMap.get(keyStr);
    } else {
        group = groupMap.createChild(keyStr);
    }
    return group;
}

function createChild(groupMap, keyStr) {
    // DataFrames have no children of their own (= leafs)
    const child = groupMap.descendantKeys.length === 1
        ? DataFrame([], groupMap.descendantKeys[0])
        : DataFrameGroupMap([], groupMap.descendantKeys[0], groupMap.descendantKeys.slice(1));
    
    groupMap.set(keyStr, child);
    return child;
}

function flatten(group, key = []) {
    function* entries() {
        for (let df of group.values()) {
            for (let row of df.values()) {
                yield row;
            }
        }
    }
    return DataFrame(entries(), key);
}
