import { DataFrame } from "../dataframe/dataFrame";
import { relativeComplement } from "../core/utils";


export function inlineReader({ values = [], keyConcepts = [], dtypes }) {
    const dataPromise = Promise.resolve(values)
        .then(parse(dtypes))
        .then(DataFrame);

    return {
        async read(query) {
            let data = await dataPromise;

            if (isConceptQuery(query))
                data = DataFrame(getConcepts(data), ["concept"]);

            if (isSchemaQuery(query))
                data = DataFrame(getSchema(data, query, keyConcepts), ["key","value"]);

            return applyQuery(data, query);
        },
        getAsset(assetId) {
            console.warn('Inline reader does not support assets', { assetId })
        },
        async getDefaultEncoding() {
            const data = await dataPromise;
            return data.fields.map(concept => ({
                concept,
                space: keyConcepts
            }));
        }
    }
}

function isConceptQuery(query) {
    return "from" in query && query.from == "concepts";
}

function isSchemaQuery(query) {
    return "from" in query && query.from.endsWith('.schema');
}

function getConcepts(data) {
    const types = getTypes(data);
    return data.fields.map(concept => ({
        concept,
        concept_type: types.get(concept)
    }));
}

function getSchema(data, { from }, keyConcepts) {
    if (from == "datapoints.schema") {
        const indicatorConcepts = relativeComplement(keyConcepts, data.fields);
        return indicatorConcepts.map(concept => ({
            key: [...keyConcepts],
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

    const result = data
        .filter(where)
        .project(projection)
        .order(order_by);
    return result;
}

/*
{
    year: { timeFormat: "%Y", locale: "ru-RU" }
    pop: number
}
*/
function parse(dtypes) {
    const parseRow = parserFromDtypes(dtypes);
    return function(data) {
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
    auto: autoParse,
    year: d3.utcParse("%Y"),
    month: d3.utcParse("%Y-%m"),
    day: d3.utcParse("%Y-%m-%d")
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
        if (!validateType(storage, field, type)) {
            console.warn("Field " + field + " is not consistently typed " + type);
            types.set(field, "mixed");
        }
    }
    return types;
}

function validateType(storage, field, type) {
    for (row of storage.values()) {
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