import { DataFrame } from "../../dataframe/dataFrame";
import { arrayEquals, isNonNullObject, relativeComplement } from "../../core/utils";

/**
 * @param {*} argPromise promise resolving to object { values, keyConcepts, dtypes }
 */
export function inlineReader(argPromise) {

    argPromise = Promise.resolve(argPromise).then((args) => {
        args.keyConcepts = args.keyConcepts ?? []; 
        return args;
    });

    let dataPromise, conceptPromise;

    return {
        async read(query) {
            if (!dataPromise) {
                dataPromise = argPromise.then(parseValues);
            }
            
            let table = await dataPromise;

            if (isConceptQuery(query)) {
                if (!conceptPromise) {
                    conceptPromise = await dataPromise
                        .then(getConcepts)
                        .then(concepts => DataFrame(concepts, ["concept"]));
                }
                table = await conceptPromise;
            }

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

function parseValues({ values, dtypes, keyConcepts}) {
    return DataFrame(makeParser(dtypes)(values), keyConcepts);
}

function isConceptQuery(query) {
    return "from" in query && query.from == "concepts";
}

function isSchemaQuery(query) {
    return "from" in query && query.from.endsWith('.schema');
}

function getConcepts(data) {
    const types = getConceptTypes(data);
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
        //make the key itself always present in schema
        const conceptTpes = getConceptTypes(data);
        const entitiesSchema = data.key
            .filter(f => conceptTpes.get(f) !== "time")
            .map(m => ({key: [m], value: m}));
        
        //this only supports names for the first dimension, but it is possible to add more, i.e. with dot notation
        if (data.fields.includes("name"))
            entitiesSchema.push({ key: [data.key[0]], value: "name" }); 
       
        return entitiesSchema;
    }
    console.warn("Invalid schema query `from` clause: ", from);
}

function applyQuery(data, query) {
    const { select, from, where, order_by, join } = query;
    const { key, value } = select;
    const projection = [...key, ...value];

    if ("join" in query){
        console.warn('Inline reader does not handle joins as it has only one table. Sections of "where" statement that refer to joins will be ignored.', { query })
        //delete where statements that refer to joins
        for (let w in where) {
            if(Object.keys(join).includes(where[w])) delete where[w]; 
        }
    }

    if (relativeComplement([...data.fields], projection).length > 0)
        console.error('Concepts found in query.select which are not in data', { query, dataFields: data.fields});

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
    time: (d) => {
        if ((""+d).length == 4) return dtypeParsers.year(d);
        if (d.length == 7 && d[4] == "-") return dtypeParsers.month(d);
        if (d.length == 10) return dtypeParsers.day(d);
        if (d[4].toLowerCase() == "w") return dtypeParsers.week(d);
        if (d[4].toLowerCase() == "q") return dtypeParsers.quarter(d);
    }, 
    year: d3.utcParse("%Y"),
    month: d3.utcParse("%Y-%m"),
    day: d3.utcParse("%Y-%m-%d"),
    week: d3.utcParse("%Yw%V"),
    quarter: d3.utcParse("%Yq%q")
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
        if (isNonNullObject(dtype) && "timeFormat" in dtype) parser = d3.utcParse(dtype.timeFormat);

        if (!parser) {
            console.warn('Unknown data type given, fall back to identity parser.', dtype);
            parser = d => d;
        }
        parsers[field] = parser;
    }

    // return row parser
    return (row) => {
        let parse, field;
        for (field in row) {
            if (parse = parsers[field]) {
                row[field] = parse(row[field]);
            }
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

function getConceptTypes(data) {
    const types = new Map();

    // get types from first row
    const [firstRow] = data.values();
    for (let field in firstRow) {
        types.set(field, getConceptType(firstRow[field], field, data.key));
    }
    // check if those types are consistent
    for (let [field, type] of types) {
        const checkedType = validateConceptType(data, field, type);
        if (!checkedType) {
            console.warn("Field " + field + " is not consistently typed " + type);
            types.set(field, "mixed");
        } else if (type === "null") {
            types.set(field, checkedType !== type ? checkedType : undefined);
        }
    }
    return types;
}

function validateConceptType(data, field, type) {
    let conceptType;
    for (let row of data.values()) {
        conceptType = getConceptType(row[field], field, data.key);
        if ( type !== conceptType ) {
            if (type === "null") {
                type = conceptType;
            } else if (conceptType !== "null") return false;
        }
    }
    return type;
}

function getConceptType(value, field, datakey) {
    if (value === null) return 'null';
    if (isDate(value)) return 'time';
    if(datakey.includes(field)) return 'entity_domain';
    const type = typeof value;
    if (type == "string")  return 'string';
    if (type == "boolean") return 'boolean';
    if (type == "number" || isNumber(value))  return 'measure';
    console.warn("Couldn't decide type of value", { value, field, datakey });
}

const isDate = val => val instanceof Date
const isNumber = val => !!val && typeof val === "object" && Object.prototype.toString.call(val) === "[object Number]";