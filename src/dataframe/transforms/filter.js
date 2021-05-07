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
 * Partially apply applyFilterRow, giving only the filter spec
 * @param {Object} filterSpec Filter specification according to DDFQL WHERE spec
 * @returns {Function} Filter function, which takes an object and returns a boolean representing if the object satifies the filterSpec
 */
export function createFilterFn(filterSpec = {}) {
    return (row) => applyFilterRow(row, filterSpec);
}

export function applyFilterRow(row, filter) {
    // implicit $and in filter object handled by .every()
    return Object.keys(filter).every(filterKey => {
        let operator;
        if (filterKey.startsWith('$')) {
            if (operator = operators.get(filterKey)) {
                // { $eq: "europe" } / { $lte: 5 } / { $and: [{...}, ...] }
                return operator(row, filter[filterKey]);
            } else {
                console.warn('Unknown operator: ', { operator: filterKey, filter, row });
                return true;
            }
        } else if(typeof filter[filterKey] != "object") { // assuming values are primitives not Number/Boolean/String objects
            // { <field>: <value> } is shorthand for { <field>: { $eq: <value> }} 
            return operators.get("$eq")(row[filterKey], filter[filterKey]);
        } else {
            // filterSpec[filterKey] is an object and will thus contain a comparison operator
            // { <field>: { $<operator>: <value> }}
            // no deep objects (like in Mongo) supported:
            // { <field>: { <subfield>: { ... } } }
            return applyFilterRow(row[filterKey], filter[filterKey]);
        }
    });
}

const operators = new Map([
    /* logical operators */
    ["$and", (row, predicates) => predicates.every(p => applyFilterRow(row,p))],
    ["$or",  (row, predicates) => predicates.some(p => applyFilterRow(row,p))],
    ["$not", (row, predicate) => !applyFilterRow(row, predicate)],
    ["$nor", (row, predicates) => !predicates.some(p => applyFilterRow(row,p))],

    /* comparison operators */
    ["$eq",  (rowValue, filterValue) => rowValue === filterValue],
    ["$ne",  (rowValue, filterValue) => rowValue !== filterValue],
    ["$gt",  (rowValue, filterValue) => rowValue > filterValue],
    ["$gte", (rowValue, filterValue) => rowValue >= filterValue],
    ["$lt",  (rowValue, filterValue) => rowValue < filterValue],
    ["$lte", (rowValue, filterValue) => rowValue <= filterValue],
    ["$in",  (rowValue, filterValue) => filterValue.includes(rowValue)],
    ["$nin", (rowValue, filterValue) => !filterValue.includes(rowValue)],
]);