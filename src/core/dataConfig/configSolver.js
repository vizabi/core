import { createKeyStr } from "../../dataframe/dfutils";
import { createFilterFn } from "../../dataframe/transforms/filter";
import { isReference } from "../config";
import { combineStates, createSpaceFilterFn, isNonNullObject, mode, subsets } from "../utils";

/**
 * Finds a config which satisfies both marker.space and encoding.concept autoconfigs
 */
const solveMethods = {}

export const configSolver = {
    addSolveMethod,
    configSolution,
    markerSolvingState,
    dataConfigSolvingState
}

function addSolveMethod(fn, name = fn.name) {
    solveMethods[name] = fn;
}

//configSolution can be requested by dataConfig of marker, of an encoding, or standalone
function configSolution(dataConfig) {     
    if (dataConfig.marker) {
    // autoconfig needs to be solved on the marker level, because encoding solutions are intertwined
    // this is why we are checking for marker that is involved, both DC of enc and marker have a .marker
        if (dataConfig.hasEncodingMarker) {
            //if it's an encoding, grab the corresponding part of marker solution.
            //this would also trigger marker solution if it wasn't yet computed
            if (dataConfig.marker.data.configSolution)
                return dataConfig.marker.data.configSolution.encodings[dataConfig.parent.name];
            else 
                //or return undefined for no-data encoding without throwing an error
                return { concept: undefined, space: undefined };
        } else {
            //or else: actually start solving autoconfig on a marker level
            return markerSolution(dataConfig);
        }
    } else {
        // stand-alone dataConfig, not a common case but helpful for tests
        return encodingSolution(dataConfig);
    }
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

        //the callback in third argument checks that whatever space candidate is suggested by autoConfigSpace,
        //it also has a solution for encodings
        return autoConfigSpace(dataConfig, undefined, space => findMarkerConfigForSpace(dataConfig, space))

    } else {
        //for whatever space is configured, find solutions for encoding
        return findMarkerConfigForSpace(dataConfig, cfg.space);
    }
}


// this function is used for both marker space and for encoding space
function autoConfigSpace(dataConfig, extraOptions = {}, getFurtherResult) {
    // getFurtherResult for marker: is there also solution for encodings
    // getFurtherResult for encoding: can we find concept for this space

    const { markerSpaceCfg } = extraOptions;
    let availableSpaces
    //get all the spaces a solution could be set to
    if (dataConfig.hasEncodingMarker && markerSpaceCfg) {
        //for encoding space under a known marker space: we need to match with marker space
        //start with getting all subsets of marker space, filter by availability
        availableSpaces = subsets(markerSpaceCfg)
            .filter(space => dataConfig.source.availability.keyLookup.has(createKeyStr(space)))
        availableSpaces = sortSpacesByPreference(availableSpaces);
        //add marker space itself too - as most preferable
        availableSpaces.unshift(markerSpaceCfg);
    } else {
        //for marker spaces: get from pure availability
        availableSpaces = Array.from(dataConfig.source.availability.keyLookup.values());
        availableSpaces = sortSpacesByPreference(availableSpaces);
    }

    //put candidates through some filters
    const solveFilterSpec = dataConfig.config.space?.filter || dataConfig.defaults.space?.filter;
    const solveFilter = createSpaceFilterFn(solveFilterSpec, dataConfig);
    const allowFilter = dataConfig.allow.space?.filter || (() => true);

    for (let space of availableSpaces) {
        let result;        
        if (!space.includes("concept") //hardcoded disallowing to have concept "concept" in space
            && solveFilter(space)
            && allowFilter(space)
            && (result = getFurtherResult(space))
        ) {
            //return the first satisfactory space because they are sorted
            return result
        }
    }
    
    console.warn("Could not autoconfig to a space which also satisfies further results for " + dataConfig.parent.id + ".", { 
        dataConfig,
        spaceCfg: dataConfig.config.space || dataConfig.defaults.space, 
        availableSpaces, 
        getFurtherResult });

    return { concept: undefined, space: undefined };
}


// 1-dim spaces go in back of the list, others: smallest spaces first
function sortSpacesByPreference(spaces) {
    return spaces.sort((a, b) => a.length > 1 && b.length > 1 ? a.length - b.length : b.length - a.length); 
}


//this is called to try if a space candidate works or for a space that is set
//even the explicitly configured concepts go through here because we need to know what concepts they are at
//so we don't set other encs to the same concepts
function findMarkerConfigForSpace(markerDataConfig, space) {
    let encodings = {};

    //track concepts used by previous encodgins so they are not used again
    let usedConcepts = new Set();
    let dataConfigResults = new Map(); 

    //every single encoding should have a compatible configuration, so that space would be good for marker
    let success = sortedEncodingEntries(markerDataConfig.parent.encoding).every(([name, enc]) => {

        // only one result per dataConfig, multiple encodings can have the same dataConfig (e.g. by reference)
        //if we already have results for a certain data config: return that from saved dataConfigResults
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


//sort encodings so that the autoconfig for them is stable
function sortedEncodingEntries(encodingObject) {
    return [...Object.entries(encodingObject)]
        .sort(
            (a, b) => a[0].localeCompare(b[0])
        );
}


function encodingSolution(dataConfig, markerSpaceCfg, usedConcepts = []) {

    if (dataConfig.isConstant) 
        //nothing to solve
        return { concept: undefined, space: undefined };

    else if (needsSpaceAutoCfg(dataConfig)) 
        //same pattern with the callback as in markerSolution
        return autoConfigSpace(dataConfig, { usedConcepts, markerSpaceCfg }, space => {
            return findConceptForSpace(dataConfig, { usedConcepts, markerSpaceCfg }, space)
        })

    else if (needsConceptAutoCfg(dataConfig))

        return findConceptForSpace(dataConfig, { usedConcepts });

    else
        //no autoconfig needed
        //select and highlight end up in this branch becuase they are hard-configured on enc level
        return {
            space: "space" in dataConfig.config ? dataConfig.config.space : dataConfig.defaults.space,
            concept: "concept" in dataConfig.config ? dataConfig.config.concept : dataConfig.defaults.concept
        }    
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
    space = space || dataConfig.config.space || dataConfig.defaults.space;

    //need to check it if we got here through autoconfig of space in encodingSolution() 
    if (needsConceptAutoCfg(dataConfig)) {
        const solveConcept = solveMethods[conceptCfg.solveMethod] || defaultConceptSolver;
        concept = solveConcept(space, dataConfig, usedConcepts)
    } else if (isReference(conceptCfg) || dataConfig.isConceptAvailableInSpace(space, conceptCfg)) {
        concept = conceptCfg;
    } 

    if (!concept) {
        // console.warn("Could not autoconfig concept for given space for " + dataConfig.parent.id  + ".", { dataConfig, space });
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

    //get all concepts available for a space
    const availableConcepts = availability.keyValueLookup.get(createKeyStr(space));
    if (!availableConcepts) 
        return;
    const filteredConcepts = [...availableConcepts.keys()]
        // exclude the ones such as "is--country", they won't get resolved
        .filter(concept => concept.substr(0,4) !== "is--")
        // get concept objects
        .map(dataSource.getConcept.bind(dataSource))
        // configurable filter
        .filter(satisfiesFilter);

    //select method can again be configured
    const selectMethod = solveMethods[conceptCfg.selectMethod] || selectUnusedConcept;
    return selectMethod({ concepts: filteredConcepts, dataConfig, usedConcepts, space })?.concept;
}

/**
 * Get the property that exists on most entity concepts in space.
 * Possibly limited by `allowedProperties` in the concept solving options.
 * Takes all properties of all entitity sets in a given space, pushes them into an array
 * then gets the mode of that array, i.e. most common value
 * Used only for labels
 * @param {*} space 
 * @param {*} dataConfig 
 * @returns 
 */
//TODO: rename to mostCommonEntityPropertyForSpace
function mostCommonDimensionProperty(space, dataConfig) {
    const dataSource = dataConfig.source;
    const kvLookup = dataSource.availability.keyValueLookup;
    const entitySpace = space.filter(dim => dataSource.isEntityConcept(dim));
    
    const conceptCfg = dataConfig.config.concept || dataConfig.defaults.concept;
    const allowedProperties = conceptCfg.allowedProperties;

    const occurences = [];
    for (let dim of entitySpace) {
        let concepts;
        const allProperties = kvLookup.get(createKeyStr([dim]));
        if (allProperties && allowedProperties) {
            concepts = allowedProperties.filter(c => allProperties.has(c));
        } else if (allProperties) {
            concepts = allProperties.keys();
        } else if (entitySpace.length === 1) {
            //dimension has no entity properties --> return dimension name itself if it's the only dimension
            concepts = [dim];
        } else {
            //otherwise setting concept to a single dim in a multidim situation would result
            //in ambiguity (i.e. "chn" label for "geo:chn gender:male" marker)
            //therefore we set concept to null and let the encoding be underconfigured
            //this situation can be handled later
            concepts = [null];
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

    const explicitNoSpace = "space" in cfg && !cfg.space; //such as select, highlight encodings
    const defaultNeedsSolving = !cfg.space && needsSolving(defaults.space);

    return !dataConfig.isConstant 
        && !explicitNoSpace 
        && (needsSolving(cfg.space) || defaultNeedsSolving)
}

function needsConceptAutoCfg(dataConfig) {
    const cfg = dataConfig.config;
    const defaults = dataConfig.defaults;

    const isStandAloneDataConfig = !dataConfig.marker; //for tests
    const explicitNoConcept = "concept" in cfg && !cfg.concept; //such as select, highlight encodings
    const isEncodingDataConfig = dataConfig.hasEncodingMarker; //check we are on enc level
    const defaultNeedsSolving = !("concept" in cfg) && needsSolving(defaults.concept);
    
    return !dataConfig.isConstant 
        && !isReference(dataConfig.config.concept) //not even try to autoconfigure references (weird infinite loops)
        && !explicitNoConcept 
        && (needsSolving(cfg.concept)
        || ((isEncodingDataConfig || isStandAloneDataConfig) && defaultNeedsSolving));
}

//if it's a space then it's array, if it's object, then it's instructions to autoconfigure
//if it's an array (for space) or a string (for concept) we know it's set by user
function needsSolving(config) {
    return isNonNullObject(config) && !Array.isArray(config);
}

function needsAutoConfig(dataConfig) {
    return dataConfig.source && (needsSpaceAutoCfg(dataConfig) || needsConceptAutoCfg(dataConfig));
}

function dataConfigSolvingState(dataConfig) {
    if (needsAutoConfig(dataConfig))
        return [dataConfig.source.conceptsState];
    else 
        return [];
}

function markerSolvingState(marker) {
    const dataConfigs = [marker.data];
    for (const enc of Object.values(marker.encoding)) { dataConfigs.push(enc.data) };
    //if we need to autoconfigure space we need to wait concepts to be loaded first
    //which in turn will wait for availability...
    const states = dataConfigs.flatMap(dataConfigSolvingState);
    //here we combine states of all dataConfigs in marker and its encodings
    return combineStates(states);
}
