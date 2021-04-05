import { createKeyStr } from "../../dataframe/dfutils";
import { createFilterFn } from "../../dataframe/transforms/filter";
import { resolveRef } from "../config";
import { fromPromiseAll, isNonNullObject } from "../utils";

/**
 * Finds a config which satisfies both marker.space and encoding.concept autoconfigs
 */
const methods = {}

export const configSolver = {
    addSelectMethod(fn, name = fn.name) {
        methods[name] = fn;
    },
    configSolution,
    needsAutoConfig,
    encodingSolution,
    markerPromiseBeforeSolving,
    dataConfigPromisesBeforeSolving
}

function configSolution(dataConfig) {     
    if (dataConfig.marker) {
        if (dataConfig.hasEncodingMarker) {
            return dataConfig.marker.data.configSolution.encodings[dataConfig.parent.name];
        } else {
            return markerSolution(dataConfig);
        }
    } else {
        // stand-alone dataConfig
        return encodingSolution(dataConfig);
    }
}

function encodingSolution(dataConfig, fallbackSpaceCfg, avoidConcepts = []) {
    let result;
    // const [userSpace, defaultSpace] = splitConfig(this.config, 'space');
    let spaceCfg = "space" in dataConfig.config ? resolveRef(dataConfig.config.space) : fallbackSpaceCfg || dataConfig.defaults.space;
    let conceptCfg = "concept" in dataConfig.config ? resolveRef(dataConfig.config.concept) : dataConfig.defaults.concept;

    if (needsSpaceAutoCfg(dataConfig)) {
        result = findSpaceAndConcept(dataConfig, avoidConcepts);
    } else if (needsConceptAutoCfg(dataConfig)) {
        const plainArraySpace = spaceCfg.slice(0);
        result = findConceptForSpace(plainArraySpace, dataConfig, avoidConcepts);
    } else {
        result = {
            space: spaceCfg,
            concept: conceptCfg
        }
    }

    return result;
}

function findMarkerConfigForSpace(markerDataConfig, space) {
    let encodings = {};
    let usedConcepts = [];

    let success = [...Object.entries(markerDataConfig.parent.encoding)].every(([name, enc]) => {
        let encResult = encodingSolution(enc.data, space, usedConcepts);
        if (encResult) {
            encodings[name] = encResult;
            usedConcepts.push(encResult.concept);
            return true;
        }
        return false;
    });

    return success ? { encodings, space } : undefined;
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

        return autoConfigSpace(dataConfig, space => findMarkerConfigForSpace(dataConfig, space))

    } else {
        return findMarkerConfigForSpace(dataConfig, cfg.space);
    }
}

function autoConfigSpace(dataConfig, getFurtherResult) {

    const spaceFilter = (dataConfig.config.space && dataConfig.config.space.filter) || (dataConfig.defaults.space && dataConfig.defaults.space.filter);
    const satisfiesSpaceFilter = createFilterFn(spaceFilter);
    const spaces = [...dataConfig.source.availability.keyLookup.values()]
        .sort((a, b) => a.length - b.length); // smallest spaces first

    for (let space of spaces) {
        let result;
        if (!space.includes("concept") 
            && space
                .map(c => dataConfig.source.getConcept(c))
                .every(satisfiesSpaceFilter)
            && (result = getFurtherResult(space))
        ) {
            return result
        }
    }
    
    console.warn("Could not autoconfig to a space which also satisfies further results.", { dataConfig, spaceCfg });

    return false;
}

function findSpaceAndConcept(dataConfig, avoidConcepts) {

    return autoConfigSpace(dataConfig, space => {
        return findConceptForSpace(space, dataConfig, avoidConcepts)
    })

}

function isConceptAvailableForSpace(availability, space, concept) {
    const keyStr = createKeyStr(space);
    return availability.keyValueLookup.get(keyStr).has(concept);
}

function needsSolving(config) {
    config = resolveRef(config);
    return isNonNullObject(config) && !Array.isArray(config);
}

/**
 * Tries to find encoding concept for a given space, encoding and partial solution which contains concepts to avoid.  
 * Should be called with encoding.data as `this`. 
 * Returns concept id which satisfies encoding definition (incl autoconfig) and does not overlap with partial solution.
 * @param {*} space 
 * @param {*} conceptCfg
 * @param {*} avoidConcepts array of concept ids to avoid in finding autoconfig solution
 * @returns {string} concept id
 */
function findConceptForSpace(space, dataConfig, usedConcepts = []) {
    let concept;
    const conceptCfg = dataConfig.config.concept || dataConfig.defaults.concept;
    const dataSource = dataConfig.source;
    const availability = dataSource.availability;

    if (dataConfig.isConstant()) {
        return { concept: undefined, space };
    } else if (needsSolving(conceptCfg)) {
        const satisfiesFilter = conceptCfg.filter 
            ? createFilterFn(conceptCfg.filter)
            : () => true;

        const filteredConcepts =  [...availability.keyValueLookup.get(createKeyStr(space)).keys()]
            // should be able to show space concepts (e.g. time)
            .concat(space)
            // exclude the ones such as "is--country", they won't get resolved
            .filter(concept => concept.substr(0,4) !== "is--")
            // get concept objects
            .map(dataSource.getConcept.bind(dataSource))
            // configurable filter
            .filter(satisfiesFilter);
        
        const selectMethod = methods[conceptCfg.selectMethod] || selectUnusedConcept;
        concept = selectMethod({ concepts: filteredConcepts, dataConfig, usedConcepts, space }).concept
            || undefined;
        
    } else if (isConceptAvailableForSpace(availability, space, conceptCfg)) {
        concept = conceptCfg;
    } 

    if (!concept) {
        console.warn("Could not autoconfig concept for given space.", { dataconfig: this, space });
        return false;
    } 

    return { concept, space };
}

function selectUnusedConcept({ concepts, usedConcepts }) {
    // first try unused concepts, otherwise, use already used concept
    return concepts.find(concept => !usedConcepts.includes(concept)) || concepts[0];
}

function needsSpaceAutoCfg(dataConfig) {
    const cfg = dataConfig.config;
    const defaults = dataConfig.defaults;
    const isMarkerOrStandaloneDataConfig = !dataConfig.hasEncodingMarker;
    const usesDefaultAutoConfig = !cfg.space && needsSolving(defaults.space);
    return needsSolving(cfg.space) 
        || (isMarkerOrStandaloneDataConfig && usesDefaultAutoConfig);
}

function needsConceptAutoCfg(dataConfig) {
    const cfg = dataConfig.config;
    const defaults = dataConfig.defaults;
    const isStandAloneDataConfig = !dataConfig.marker;
    const isNotMarkerDataConfig = dataConfig.hasEncodingMarker;
    const usesDefaultSolving = !("concept" in cfg) && needsSolving(defaults.concept);
    return needsSolving(cfg.concept)
        || ((isNotMarkerDataConfig || isStandAloneDataConfig) && usesDefaultSolving);
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
