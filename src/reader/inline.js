import { DataFrame } from "../dataframe/dataFrame";
import { relativeComplement } from "../core/utils";


export function inlineReader({ values = [], keyConcepts = [] }) {
    const dataPromise = Promise.resolve(values).then(DataFrame);

    return {
        async read(query) {
            let source = await dataPromise;

            if (isConceptQuery(query))
                source = DataFrame(getConcepts(source), ["concept"]);

            if (isSchemaQuery(query))
                source = DataFrame(getSchema(source, query, keyConcepts), ["key","value"]);

            return applyQuery(source, query);
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

function getConcepts(data) {
    const types = getTypes(data);
    return data.fields.map(concept => ({
        concept,
        concept_type: types.get(concept)
    }));
}

function isSchemaQuery(query) {
    return "from" in query && query.from.endsWith('.schema');
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