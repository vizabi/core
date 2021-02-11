import { DataFrame } from "../../dataFrame/dataFrame";
import { arrayEquals, isNonNullObject, relativeComplement } from "../../core/utils";

/**
 * @param {*} argPromise promise resolving to object { values, keyConcepts, dtypes }
 */
export function inlineReader(argPromise) {

    argPromise = Promise.resolve(argPromise); // promisify plain object arg
    const dataPromise = argPromise.then(parseValues);
    const conceptPromise = dataPromise.then(data => DataFrame(getConcepts(data), ["concept"]));

    return {
        async read(query) {
            let table = await dataPromise;

            if (isConceptQuery(query))
                table = await conceptPromise;

            if (isSchemaQuery(query))
                table = DataFrame(getSchema(table, query.from), ["key","value"])

            return applyQuery(table, query);
        },
        getAsset(assetId) {
            console.warn('Inline reader does not support assets', { assetId })
        },
        async getDefaultEncoding() {
            const { keyConcepts } = await argPromise;
            const data = await dataPromise;
            const encConfig = {};
            data.fields.forEach(concept => {
                encConfig[concept] = {
                    concept, 
                    space: keyConcepts
                }
            });
            return encConfig;
        }
    }
}

function parseValues({ values, dtypes, keyConcepts }) {
    return DataFrame(makeParser(dtypes)(values), keyConcepts);
}

function isConceptQuery(query) {
    return "from" in query && query.from == "concepts";
}

function isSchemaQuery(query) {
    return "from" in query && query.from.endsWith('.schema');
}

function getConcepts(data) {
    const types = getTypes(data);
    return [...data.fields].map(concept => ({
        concept,
        concept_type: types.get(concept)
    }));
}

function getSchema(data, from) {
    if (from == "datapoints.schema") {
        const indicatorConcepts = relativeComplement(data.key, [...data.fields]);
        return indicatorConcepts.map(concept => ({
            key: [...data.key],
            value: concept
        }));        
    }
    if (from == "concepts.schema") {
        return [{ key: ["concept"], value: "concept_type"}];
    }
    if (from == "entities.schema") {
        return [];
    }
    console.warn("Invalid schema query `from` clause: ", from);
}

function applyQuery(data, query) {
    const { select, from, where, order_by, join } = query;
    const { key, value } = select;
    const projection = [...key, ...value];

    if ("join" in query)
        console.warn('Inline reader does not handle joins as it handles only one table.', { query })

    let result = data
        .filter(where)
        .project(projection)
        .order(order_by);

    if (!arrayEquals(result.key, select.key))
        result = DataFrame(result, select.key);
    
    return result;
}

/*
{
    year: { timeFormat: "%Y", locale: "ru-RU" }
    pop: number
}
*/
function makeParser(dtypes) {
    const parseRow = parserFromDtypes(dtypes);
    return function parseTable(data) {
        let row;
        for (row of data) {
            parseRow(row); // in place
        }
        return data;
    }
}

const dtypeParsers = {
    string: d => d,
    number: d => +d,
    boolean: d => d == '1' || d.toLowerCase() == 'true',
    auto: autoParse,
    year: d3.utcParse("%Y"),
    month: d3.utcParse("%Y-%m"),
    day: d3.utcParse("%Y-%m-%d"),
    week: d3.utcParse("%Yw%V")
}

function parserFromDtypes(dtypes) {

    if (dtypes == "auto") 
        return d3.autoType;

    // create field parsers
    const parsers = {};
    let field;
    
    for (field in dtypes) {
        const dtype = dtypes[field];

        let parser;
        if (dtype in dtypeParsers) parser = dtypeParsers[dtype];
        if ("timeFormat" in dtype) parser = d3.timeParse(dtype.timeFormat);

        if (!parser) console.warn('Unknown date type given, fall back to identity parser.', dtype);
        parsers[dtype] = parser || (d => d);
    }

    // return row parser
    return (row) => {
        let parse, field;
        for (field in row) {
            if (parse = parsers[field]) 
                row[field] = parse(row[field]);
        }
    }
}

/**
 * Parse string to js primitives or Date. Based on d3.autoType
 * @param {any} value Value to be parsed 
 */
function autoParse(value) {
    var value = value.trim(), number;
    if (!value) value = null;
    else if (value === "true") value = true;
    else if (value === "false") value = false;
    else if (value === "NaN") value = NaN;
    else if (!isNaN(number = +value)) value = number;
    else if (/^([-+]\d{2})?\d{4}(-\d{2}(-\d{2})?)?(T\d{2}:\d{2}(:\d{2}(\.\d{3})?)?(Z|[-+]\d{2}:\d{2})?)?$/.test(value)) value = new Date(value);
    return value;
}

function getTypes(data) {
    const types = new Map();

    // get types from first row
    const [firstRow] = data.values();
    for (let field in firstRow) {
        types.set(field, getType(firstRow[field]));
    }
    // check if those types are consistent
    for (let [field, type] in types) {
        if (!validateType(data, field, type)) {
            console.warn("Field " + field + " is not consistently typed " + type);
            types.set(field, "mixed");
        }
    }
    return types;
}

function validateType(data, field, type) {
    for (row of data.values()) {
        if (getType(row[field]) !== type)
            return false;
    }
}

function getType(value) {
    if (isDate(value))    return 'time';
    if (isString(value))  return 'string';
    if (isNumber(value))  return 'measure';
    if (isBoolean(value)) return 'boolean';
    console.warn("Couldn't decide type of value.", { value });
}

const isDate = val => val instanceof Date
const isNumber = val => typeof val === "number" || !!val && typeof val === "object" && Object.prototype.toString.call(val) === "[object Number]";
const isString = val => typeof val === "string";
const isBoolean = val => typeof val === "boolean";