import { deepclone, pipe } from "../../core/utils";
import { DataFrame } from "../dataFrame";

/**
 * Filters dataframe based on either filter function or DDFQL filter specification
 * @param {DataFrame} df 
 * @param {Function|FilterSpec} filter 
 */
export function filter(df, filter) {

    if (!validFilterArg(filter))
        return df;

    const filterFn = (typeof filter == "function") ? 
        filter : createFilterFn(filter);    

    const result = DataFrame([], df.key);
    for(let key of df.keys()) {
        const row = df.getByStr(key);
        if (filterFn(row))
            result.set(row, key);
    }

    return result;
}

function validFilterArg(filter) {
    return filter && (typeof filter === "function" || Object.keys(filter).length > 0)
}

/**
 * Create a function, given a filter spec
 * @param {Object} filterSpec Filter specification according to DDFQL WHERE spec
 * @returns {Function} Filter function, which takes an object and returns a boolean representing if the object satifies the filterSpec
 */
export function createFilterFn(filterSpec = {}) {
    let fn = 'return '
    fn += createFilterFnString(filterSpec);
    fn += ';';
    return new Function('row', fn);
}

function normalizeFilter(filterSpec) {
    
    filterSpec = deepclone(filterSpec);
    filterSpec = implicitAnd(filterSpec);
    filterSpec = implicitEq(filterSpec);

    return filterSpec;

    function implicitAnd(filter) {
        const keys = Object.keys(filter);
        if (keys.length > 1) {
            return { $and: 
                keys.map(key => ({ [key]: filter[key] }))
            };
        } else {
            return filter;
        }
    }
    
    function implicitEq(filter) {
        const key = Object.keys(filter)[0]
        if (!key.startsWith('$') && typeof filter[key] != "object") {
            filter[key] = { $eq: filter[key] }
        }
        return filter;
    }
}

/**
 * Returns a string function body for the given filter spec. This method was tested to be faster than walking through filterSpec "run-time".
 * @param {*} filterSpec 
 * @returns 
 */
function createFilterFnString(filterSpec) {
    filterSpec = normalizeFilter(filterSpec);
    let key = Object.keys(filterSpec)[0];
    if (key.startsWith('$')) {
        return logicalToString[key](filterSpec[key]);
    } else {
        const operator = Object.keys(filterSpec[key])[0];
        return comparisonToString[operator](key, JSON.stringify(filterSpec[key][operator]));
    } 
    
}

const logicalToString = {
    '$not': (spec) => `!${createFilterFnString(spec)}`,
    '$and': (spec) => `(${spec.map(createFilterFnString).join(' && ')})`,
    '$or':  (spec) => `(${spec.map(createFilterFnString).join(' || ')})`,
    '$nor': (spec) => `!(${spec.map(createFilterFnString).join(' || ')})`,
}
const comparisonToString = {
    "$eq":  (field, val) => `row.${field} === ${val}`,
    "$ne":  (field, val) => `row.${field} !== ${val}`,
    "$gt":  (field, val) => `row.${field} > ${val}`,
    "$gte": (field, val) => `row.${field} >= ${val}`,
    "$lt":  (field, val) => `row.${field} < ${val}`,
    "$lte": (field, val) => `row.${field} <= ${val}`,
    "$in":  (field, val) => `${val}.includes(row.${field})`,
    "$nin": (field, val) => `!${val}.includes(row.${field})`,
}