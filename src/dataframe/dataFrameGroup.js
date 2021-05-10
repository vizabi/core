import { DataFrame } from "./dataFrame";
import { isDataFrame, createKeyFn, arrayEquals, pick } from "./dfutils";
import { extent, extentOfGroupKey, extentOfGroupKeyPerMarker } from "./info/extent";
import { reindexGroup } from "./transforms/reindex";

/**
 * 
 * @param {*} df DataFrame from which to create groups
 * @param {*} key key by which is grouped
 * @param {*} descKeys keys of groups and their descendants
 */
export function DataFrameGroup(df, key, descKeys = []) {

    if (!Array.isArray(descKeys)) descKeys = [[descKeys]]; // desc keys is single string (e.g. 'year')
    if (!Array.isArray(descKeys[0])) descKeys = [descKeys]; // desc keys is one key (e.g. ['year'])
    if (!Array.isArray(key)) key = [key]; // key is single string (e.g. 'year')
    if (!isDataFrame(df)) df = DataFrame(df);
    if (descKeys.length === 0) descKeys = [df.key];  // descKeys is empty
    
    const group = createGroup(key, descKeys)
    group.batchSetRow(df);

    return group; 
}

function createGroup(key, descendantKeys) {
    const group = new Map();
    const keyObjects = new WeakMap();
    const set = group.set.bind(group);

    group.type = 'Group';
    group.key = key;
    group.keyObject = member => keyObjects.get(member);
    group.keyFn = createKeyFn(key);
    group.descendantKeys = descendantKeys;
    group.each = (fn) => each(group, fn);
    group.map = (fn) => map(group, fn);
    // group.mapCall = (fn) => mapCall(group, fn); // not exposing mapcall
    group.interpolate = mapCall(group, "interpolate");
    group.filter = mapCall(group, "filter");
    group.order = mapCall(group, "order");
    group.reindex = mapCall(group, "reindex");
    group.reindexMembers = index => reindexGroup(group, index);
    group.flatten = (key) => flatten(group, key);
    group.extent = (concept, groupBy, groupSubset) => extent(group, concept, groupBy, groupSubset),
    group.keyExtent = () => extentOfGroupKey(group);
    group.extentOfGroupKeyPerMarker = (groupSubset) => extentOfGroupKeyPerMarker(group, groupSubset),
    group.groupBy = (key) => {
        for (let [keyStr, member] of group) {
            const keyObj = group.keyObject(member);
            const newMember = member.groupBy(key);

            // groups change from DataFrame to group
            if (member.type === 'DataFrame')
                group.set(keyObj, newMember);
        }
        group.descendantKeys.push(key);
        return group;
    }
    group.createMember = (keyObj) => createMember(group, keyObj);
    group.toJSON = () => mapToObject(group);
    group.rows = function* () {
        let member, row; 
        for (member of group.values()) {
            for (row of member.rows()) // get rows recursively
                yield row;
        }
    }
    group.filterGroups = (filterFn, inplace = false) => {
        let result = inplace ? group : DataFrameGroup([], group.key, group.descendantKeys);
        for (let [key, member] of group) {
            const keyObj = group.keyObject(member);
            const newMember = member.filterGroups(filterFn, inplace);
            const filterApplies = filterFn(newMember);
            if (!inplace && filterApplies)
                result.set(keyObj, newMember);
            if (inplace && !filterApplies) 
                result.delete(key);
        }
        return result;
    }
    group.set = (keyObj, member) => {
        keyObjects.set(member, keyObj);
        const keyStr = group.keyFn(keyObj);
        set(keyStr, member);
    }
    group.setRow = (row, key) => {
        getDataFrame(group, row)
            .set(row, key);
    }
    group.batchSetRow = (data) => {
        const descKeys = group.descendantKeys;
        if (arrayEquals(data.key, descKeys[descKeys.length - 1]) && data.key.length > 0) {
            for (let row of data.values()) {
                getDataFrame(group, row)
                    .setByStr(row[Symbol.for('key')], row);
            }
        } else {
            for (let row of data.values()) {
                getDataFrame(group, row)
                    .set(row);
            }
        }
    
    }
    return group;
}

function each(group, fn) {
    for (let [keyStr, member] of group) {
        fn(member, keyStr, group);
    }
    return group;
}

function map(group, fn) {
    let result = DataFrameGroup([], group.key, group.descendantKeys);
    for (let [keyStr, member] of group) {
        const keyObj = group.keyObject(member);
        result.set(keyObj, fn(member, keyStr, group));
    }
    return result;
}

function mapCall(group, fnName) {
    return function() {
        let result = DataFrameGroup([], group.key, group.descendantKeys);
        for (let [keyStr, member] of group) {
            const keyObj = group.keyObject(member);
            result.set(keyObj, member[fnName](...arguments));
        }
        return result;
    }
}

/**
 * 
 * @param {*} group the group to find dataframe in
 * @param {*} row data row to find dataframe for
 */
function getDataFrame(group, row) {
    if (group.type == 'DataFrame') return group;
    let member;
    if (!row) {
        member = group.values().next().value;
    } else {
        const keyObj = pick(row, group.key);
        const keyStr = group.keyFn(keyObj);
        if (group.has(keyStr)) {
            member = group.get(keyStr);
        } else {
            member = group.createMember(keyObj);
        }
    }
    return getDataFrame(member, row);
}

function createMember(group, keyObj) {
    // DataFrames have no children of their own (= leafs)
    const newMember = group.descendantKeys.length === 1
        ? DataFrame([], group.descendantKeys[0])
        : DataFrameGroup([], group.descendantKeys[0], group.descendantKeys.slice(1));
    
    group.set(keyObj, newMember);
    return newMember;
}

function flatten(group, result) {
    for (let member of group.values()) {
        if (member.type == 'Group') {
            result = flatten(member, result)
        } else {
            if (!result)
                result = DataFrame(member, member.key);
            else 
                result.batchSet(member);
        }
    } 
    return result;
}
