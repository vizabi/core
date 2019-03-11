import { DataFrame } from "../dataFrame";

export function filter(df, filter) {
    if (!filter || Object.keys(filter).length == 0)
        return df;

    const result = DataFrame([], df.key);
    for(let [key, row] of df) {
        if (filterApplies(row, filter))
            result.setByKeyStr(key, row);
    }

    return result;
}

function filterApplies(row, filter) {

    // implicit $and in filter object handled by .every()
    return Object.keys(filter).every(filterKey => {
        if (operator = operators.get(filterKey)) {
            // { $eq: "europe" } / { $lte: 5 } / { $and: [{...}, ...] }
            return operator(row, filter[filterKey]);
        } else if(typeof filter[filterKey] != "object") { // assuming values are primitives not Number/Boolean/String objects
            // { <field>: <value> } is shorthand for { <field>: { $eq: <value> }} 
            return operators.get("$eq")(row[filterKey], filter[filterKey]);
        } else {
            // filter[filterKey] is an object and will thus contain a comparison operator
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
    ["$eq",  (rowValue, filterValue) => rowValue == filterValue],
    ["$ne",  (rowValue, filterValue) => rowValue != filterValue],
    ["$gt",  (rowValue, filterValue) => rowValue > filterValue],
    ["$gte", (rowValue, filterValue) => rowValue >= filterValue],
    ["$lt",  (rowValue, filterValue) => rowValue < filterValue],
    ["$lte", (rowValue, filterValue) => rowValue <= filterValue],
    ["$in",  (rowValue, filterValue) => filterValue.includes(rowValue)],
    ["$nin", (rowValue, filterValue) => !filterValue.includes(rowValue)],
]);