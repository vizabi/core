import { createKeyStr } from "../../dataframe/dfutils";
import { createFilterFn } from "../../dataframe/transforms/filter";
import { isReference } from "../config";
import { createSpaceFilterFn, fromPromiseAll, isNonNullObject, mode, subsets } from "../utils";

/**
 * Finds a config which satisfies both marker.space and encoding.concept autoconfigs
 */
const solveMethods = {}

export const configSolver = {
    addSolveMethod,
    configSolution,
    needsAutoConfig,
    encodingSolution,
    markerPromiseBeforeSolving,
    dataConfigPromisesBeforeSolving
}

function addSolveMethod(fn, name = fn.name) {
    solveMethods[name] = fn;
}

function configSolution(dataConfig) {     
    if (dataConfig.marker) {
        if (dataConfig.hasEncodingMarker) {
            if (dataConfig.marker.data.configSolution)
                return dataConfig.marker.data.configSolution.encodings[dataConfig.parent.name];
            else 
                return { concept: undefined, space: undefined };
        } else {
            return markerSolution(dataConfig);
        }
    } else {
        // stand-alone dataConfig
        return encodingSolution(dataConfig);
    }
}

function encodingSolution(dataConfig, markerSpaceCfg, usedConcepts = []) {
    let result;    

    if (dataConfig.isConstant) {
        result = { concept: undefined, space: undefined };
    } else if (needsSpaceAutoCfg(dataConfig)) {
        result = findSpaceAndConcept(dataConfig, { usedConcepts, markerSpaceCfg });
    } else if (needsConceptAutoCfg(dataConfig)) {
        result = findConceptForSpace(dataConfig, { usedConcepts });
    } else {
        result = {
            space: "space" in dataConfig.config ? dataConfig.config.space : dataConfig.defaults.space,
            concept: "concept" in dataConfig.config ? dataConfig.config.concept : dataConfig.defaults.concept
        }
    }

    return result;
}

function findMarkerConfigForSpace(markerDataConfig, space) {
    let encodings = {};
    let usedConcepts = new Set();
    let dataConfigResults = new Map(); 

    let success = sortedEncodingEntries(markerDataConfig.parent.encoding).every(([name, enc]) => {

        // only one result per dataConfig, multiple encodings can have the same dataConfig (e.g. by reference)
        let encResult = dataConfigResults.has(enc.data) 
            ? dataConfigResults.get(enc.data)
            : encodingSolution(enc.data, space, [...usedConcepts]);

        if (encResult) {
            dataConfigResults.set(enc.data, encResult);
            encodings[name] = encResult;
            usedConcepts.add(encResult.concept);
            return true;
        }
        return false;
    });

    return success ? { encodings, space } : undefined;
}

function sortedEncodingEntries(encodingObject) {
    return [...Object.entries(encodingObject)]
        .sort(
            (a, b) => a[0].localeCompare(b[0])
        );
}

function markerSolution(dataConfig) {
    const cfg = dataConfig.config;

    if (!dataConfig.parent.encoding)
        console.warn(`Can't get marker solution for a non-marker dataconfig.`)

    if (needsSpaceAutoCfg(dataConfig)) {

        if (!dataConfig.source) {
            console.warn(`Can't autoconfigure marker space without a source defined.`)
            return;
        }

        return autoConfigSpace(dataConfig, undefined, space => findMarkerConfigForSpace(dataConfig, space))

    } else {
        return findMarkerConfigForSpace(dataConfig, cfg.space);
    }
}

function autoConfigSpace(dataConfig, extraOptions = {}, getFurtherResult) {

    const { markerSpaceCfg } = extraOptions;
    let availableSpaces;
    if (dataConfig.hasEncodingMarker && markerSpaceCfg) {
        availableSpaces = subsets(markerSpaceCfg)
            .filter(space => dataConfig.source.availability.keyLookup.has(createKeyStr(space)))
    } else {
        availableSpaces = Array.from(dataConfig.source.availability.keyLookup.values());
    }

    const solveFilterSpec = dataConfig.config.space?.filter || dataConfig.defaults.space?.filter;
    const solveFilter = createSpaceFilterFn(solveFilterSpec, dataConfig);
    const allowFilter = dataConfig.allow.space?.filter || (() => true);
    const spaces = sortSpacesByPreference(availableSpaces);

    for (let space of spaces) {
        let result;
        if (!space.includes("concept") 
            && solveFilter(space)
            && allowFilter(space)
            && (result = getFurtherResult(space))
        ) {
            return result
        }
    }
    
    console.warn("Could not autoconfig to a space which also satisfies further results.", { dataConfig, spaceCfg: dataConfig.config.space || dataConfig.defaults.space  });

    return false;
}

function sortSpacesByPreference(spaces) {
    return spaces.sort((a, b) => a.length > 1 && b.length > 1 ? a.length - b.length : b.length - a.length); // 1-dim in back, rest smallest spaces first
}

function findSpaceAndConcept(dataConfig, extraOptions) {

    return autoConfigSpace(dataConfig, extraOptions, space => {
        return findConceptForSpace(dataConfig, extraOptions, space)
    })

}

function needsSolving(config) {
    return isNonNullObject(config) && !Array.isArray(config);
}

// Add preconfigured often used solver methods 
addSolveMethod(defaultConceptSolver);
addSolveMethod(mostCommonDimensionProperty);
addSolveMethod(selectUnusedConcept);

/**
 * Tries to find encoding concept for a given space, encoding and partial solution which contains concepts to avoid.  
 * Should be called with encoding.data as `this`. 
 * Returns concept id which satisfies encoding definition (incl autoconfig) and does not overlap with partial solution.
 * @param {*} space 
 * @param {*} conceptCfg
 * @param {*} extraOptions.usedConcepts: array of concept ids to avoid in finding autoconfig solution
 * @returns {string} concept id
 */
function findConceptForSpace(dataConfig, { usedConcepts = [] }, space) {
    let concept;
    const conceptCfg = dataConfig.config.concept || dataConfig.defaults.concept;
    const spaceCfg = space || dataConfig.config.space || dataConfig.defaults.space;

    if (needsConceptAutoCfg(dataConfig)) {
        const solveConcept = solveMethods[conceptCfg.solveMethod] || defaultConceptSolver;
        concept = solveConcept(spaceCfg, dataConfig, usedConcepts)
    } else {
        concept = conceptCfg;
    } 

    if (!concept) {
        console.warn("Could not autoconfig concept for given space.", { dataConfig, spaceCfg });
        return false;
    } 

    return { concept, space };
}

function defaultConceptSolver(space, dataConfig, usedConcepts) {

    const dataSource = dataConfig.source;
    const availability = dataSource.availability;
    const conceptCfg = dataConfig.config.concept || dataConfig.defaults.concept;

    const satisfiesFilter = conceptCfg.filter 
        ? createFilterFn(conceptCfg.filter)
        : () => true;

    const filteredConcepts = [...availability.keyValueLookup.get(createKeyStr(space)).keys()]
        // exclude the ones such as "is--country", they won't get resolved
        .filter(concept => concept.substr(0,4) !== "is--")
        // get concept objects
        .map(dataSource.getConcept.bind(dataSource))
        // configurable filter
        .filter(satisfiesFilter);

    const selectMethod = solveMethods[conceptCfg.selectMethod] || selectUnusedConcept;
    return selectMethod({ concepts: filteredConcepts, dataConfig, usedConcepts, space })?.concept;
}

/**
 * Get the property that exists on most entity concepts in space.
 * Possibly limited by `allowedProperties` in the concept solving options.
 * @param {*} space 
 * @param {*} dataConfig 
 * @returns 
 */
function mostCommonDimensionProperty(space, dataConfig) {
    const dataSource = dataConfig.source;
    const kvLookup = dataSource.availability.keyValueLookup;
    const entitySpace = space.filter(dim => dataSource.isEntityConcept(dim));
    
    const conceptCfg = dataConfig.config.concept || dataConfig.defaults.concept;
    const allowedProperties = conceptCfg.allowedProperties;

    const occurences = [];
    for (let dim of entitySpace) {
        let concepts;
        let allProperties = kvLookup.get(createKeyStr([dim]));
        if (allowedProperties) {
            concepts = allowedProperties.filter(c => allProperties.has(c));
        } else {
            concepts = allProperties.keys();
        }
        occurences.push(...concepts);
    }
    return mode(occurences);
}


function selectUnusedConcept({ concepts, usedConcepts }) {
    // first try unused concepts, otherwise, use already used concept
    return concepts.find(concept => !usedConcepts.includes(concept.concept)) || concepts[0];
}

function needsSpaceAutoCfg(dataConfig) {
    const cfg = dataConfig.config;
    const defaults = dataConfig.defaults;
    const explicitNoSpace = "space" in cfg && !cfg.space;
    const usesDefaultAutoConfig = !cfg.space && needsSolving(defaults.space);
    return !explicitNoSpace 
        && (needsSolving(cfg.space) || usesDefaultAutoConfig)
}

function needsConceptAutoCfg(dataConfig) {
    const cfg = dataConfig.config;
    const defaults = dataConfig.defaults;
    const isStandAloneDataConfig = !dataConfig.marker;
    const explicitNoConcept = "concept" in cfg && !cfg.concept;
    const isNotMarkerDataConfig = dataConfig.hasEncodingMarker;
    const usesDefaultSolving = !("concept" in cfg) && needsSolving(defaults.concept);
    return !isReference(dataConfig.config.concept) && !explicitNoConcept && (needsSolving(cfg.concept)
        || ((isNotMarkerDataConfig || isStandAloneDataConfig) && usesDefaultSolving));
}

function needsAutoConfig(dataConfig) {
    return needsSpaceAutoCfg(dataConfig) || needsConceptAutoCfg(dataConfig);
}

function dataConfigPromisesBeforeSolving(dataConfig) {
    if (needsAutoConfig(dataConfig))
        return [dataConfig.source.metaDataPromise];
    else 
        return [];
}

function markerPromiseBeforeSolving(marker) {
    const dataConfigs = [marker.data];
    for (const enc of Object.values(marker.encoding)) { dataConfigs.push(enc.data) };
    const promises = dataConfigs.flatMap(dataConfigPromisesBeforeSolving);
    const uniquePromises = [...new Set(promises)];
    return fromPromiseAll(uniquePromises);
}
