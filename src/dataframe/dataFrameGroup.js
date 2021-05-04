import { DataFrame } from "./dataFrame";
import { parseMarkerKey, isDataFrame, createKeyFn, arrayEquals } from "./dfutils";
import { extent, extentOfGroupKeyPerMarker } from "./info/extent";

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
    group.key = key;
    group.keyFn = createKeyFn(key);
    group.descendantKeys = descendantKeys;
    group.groupType = () => group.descendantKeys.length === 1 ? 'DataFrame' : 'Group';
    group.each = (fn) => each(group, fn);
    group.map = (fn) => map(group, fn);
    // group.mapCall = (fn) => mapCall(group, fn); // not exposing mapcall
    group.interpolate = mapCall(group, "interpolate");
    group.filter = mapCall(group, "filter");
    group.order = mapCall(group, "order");
    group.reindex = mapCall(group, "reindex");
    group.flatten = (key) => flatten(group, key);
    group.extent = (concept, groupBy, groupSubset) => extent(group, concept, groupBy, groupSubset),
    group.extentOfGroupKeyPerMarker = (groupSubset) => extentOfGroupKeyPerMarker(group, groupSubset),
    group.groupBy = (key) => {
        for (let member of group.values()) {
            const newMember = member.groupBy(key);

            // groups change from DataFrame to group
            if (group.groupType() === 'DataFrame')
                group.set(key, newMember);
        }
        group.descendantKeys.push(key);
        return group;
    }
    group.createMember = (keyStr) => createMember(group, keyStr);
    group.toJSON = () => mapToObject(group);
    group.rows = function* () {
        let member, row; 
        for (member of group.values()) {
            for (row of member.rows()) // get rows recursively
                yield row;
        }
    }
    group.filterGroups = (filterFn) => {
        let result = DataFrameGroup([], group.key, group.descendantKeys);
        for (let [key, member] of group) {
            const newMember = member.filterGroups(filterFn);
            if (filterFn(newMember)) 
                result.set(key, newMember);
        }
        return result;
    }
    group.setRow = (row, key) => {
        getOrCreateMember(group, row)
            .setRow(row, key);
    }
    group.batchSetRow = (data) => {
        const descKeys = group.descendantKeys;
        if (arrayEquals(data.key, descKeys[descKeys.length - 1])) {
            for (let row of data.values()) {
                group.setRow(row, row[Symbol.for('key')]);
            }
        } else {
            for (let row of data.values()) {
                group.setRow(row);
            }
        }
    
    }
    return group;
}

function each(group, fn) {
    for (let [key, member] of group) {
        fn(member, parseMarkerKey(key));
    }
    return group;
}

function map(group, fn) {
    for (let [key, member] of group) {
        group.set(key, fn(member, parseMarkerKey(key)));
    }
    return group;
}

function mapCall(group, fnName) {
    return function() {
        let result = DataFrameGroup([], group.key, group.descendantKeys);
        for (let [key, member] of group) {
            result.set(key, member[fnName](...arguments));
        }
        return result;
    }
}

/**
 * 
 * @param {*} group the group to find member in
 * @param {*} row data row to find member for
 */
function getOrCreateMember(group, row) {
    let member;
    const keyStr = group.keyFn(row);
    if (group.has(keyStr)) {
        member = group.get(keyStr);
    } else {
        member = group.createMember(keyStr);
    }
    return member;
}

function createMember(group, keyStr) {
    // DataFrames have no children of their own (= leafs)
    const newMember = group.descendantKeys.length === 1
        ? DataFrame([], group.descendantKeys[0])
        : DataFrameGroup([], group.descendantKeys[0], group.descendantKeys.slice(1));
    
    group.set(keyStr, newMember);
    return newMember;
}

function flatten(group, result) {
    for (let member of group.values()) {
        if (group.groupType() == 'Group') {
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
