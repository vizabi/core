import { action, isObservableArray, observable, toJS, trace } from 'mobx';
import { isString, deepmerge, arrayEquals, configValue, removeOnce, createModel, isNumeric } from '../utils';
import { resolveRef } from '../config';

const defaults = {
}

export const type = 'filter';

export function filter(...args) {
    return createModel(filter, ...args)
}

function compare(object, prop, isness){
    return (object[isness] || !isness) && object[prop];
}

function getObjectBlueprint(obj = {}){
    return Object.keys(obj).sort().join(",");
}
function union(targetArray = [], sourceArray = []){
    return [...new Set([...targetArray, ...sourceArray])];
}
function substract(targetArray = [], sourceArray = []){
    const sourceSet = new Set(sourceArray);
    return targetArray.filter(f => !sourceSet.has(f));
}

/**
 * Returns all key–value combinations for an object whose values
 * may be arrays or singletons.
 *
 * @param {Object<string, any|any[]>} obj
 * @returns {Object<string, any>[]}
 */
function cartesianPermutations(obj) {
    return Object.entries(obj)
        .reduce((combos, [key, values]) => {
            // wrap non-arrays so they “repeat”
            const vals = Array.isArray(values) ? values : [values];
            return combos.flatMap(combo =>
                vals.map(val => ({ ...combo, [key]: val }))
            );
        }, [{}]);
}

function cleanEmptyObjectsAndArrays(obj){

    function notEmpty(arg) {
        if (arg instanceof Date) return true;
        return !(arg == null || typeof arg === "object" && Object.keys(arg).length === 0 || Array.isArray(arg) && arg.length === 0);
    }

    if (Array.isArray(obj)){
        obj = obj.map( d => cleanEmptyObjectsAndArrays(d) ).filter(notEmpty);
    } else if (typeof obj === "object"){
        for (const objKey in obj) {
            obj[objKey] = cleanEmptyObjectsAndArrays(obj[objKey]);
            if (!notEmpty(obj[objKey])) delete obj[objKey];
        }
    }

    return obj;
}
filter.nonObservable = function (config, parent, id) {

    if (!("markers" in config)) config.markers = [];
    if (!("dimensions" in config)) config.dimensions = {};

    return {
        id,
        config,
        parent,
        type,
        get markers() {
            const cfg = resolveRef(this.config.markers).value || {};
            const markers = (isObservableArray(cfg)) ?
                cfg.map(m => [m, true]) :
                Object.entries(cfg);
            return new Map(markers);
        },
        get dimensions() {
            return toJS(this.config.dimensions) || {};
        },
        has(d) {
            return this.markers.has(this.getKey(d));
        },
        any() {
            return this.markers.size !== 0;
        },
        getPayload(d) {
            return this.markers.get(this.getKey(d));
        },
        set: action("setFilter", function(marker, payload) {
            if (Array.isArray(marker)) {
                for (const el of marker) this.set(el);
                return;
            }
            const key = this.getKey(marker);
            const cfg = this.config.markers;
            if (payload) {
                if (Array.isArray(this.config.markers)) {
                    this.config.markers = Object.fromEntries(this.config.markers.map(m => [m,true]));
                }
                this.config.markers[key] = configValue(payload);
            } else {
                if (!Array.isArray(this.config.markers)) {
                    if (Object.keys(this.config.markers).length > 0) {
                        this.config.markers[key] = true;
                    } else {
                        this.config.markers = [key]
                    }
                } else if (!this.config.markers.includes(key)) {
                    this.config.markers.push(key);
                }
            }
        }),
        delete: action("deleteFilter", function(markerItem) {
            this.deleteFromMarkers(markerItem);
        }),
        clear: action("clearFilter", function() {
            this.config.markers = [];
        }),
        toggle: action("toggleFilter", function(marker) {
            if (this.has(marker))
                return this.delete(marker);
            else 
                return this.set(marker);
        }),
        deleteFromMarkers: action("deleteInMarkers", function(markerItem) {
            if (Array.isArray(markerItem)) {
                for (const el of markerItem) this.deleteFromMarkers(el)
                return;
            }
            const cfg = this.config.markers;
            const key = this.getKey(markerItem);
            if (Array.isArray(cfg)) {
                removeOnce(cfg, key);
            } else {
                delete cfg[key];
            }
            return !this.markers.has(key);
        }),
        getKey(d) {
            return isString(d) ? d : d[Symbol.for('key')];
        },

        /* WHAT IS LIMITED STRUCTURE?
        * THE LIMITED STRUCTURE LOOKS LIKE THIS
        * notice how this says add geo="americas" but remove all where world_4region="americas"
        *
        * filter = { 
        *   "dimensions": {
        *     "geo": {
        *       // additive section
        *       "$or": [{ 
        *           "is--global": true 
        *         },{ 
        *           "is--worl4region": true, 
        *           "geo": { "$in": ["africa", "americas"] } 
        *         },{ 
        *           "is--country": true, 
        *           "unhcr_region": { "$in": ["unhcr_asia_pacific"] } 
        *       }],
        *       // substractive section
        *       "$nor": [{
        *           "is--country": true,
        *           "west_and_rest": {"$in": ["west"]} 
        *       },{
        *           "is--worl4region": true, 
        *           "geo": {"$in": ["asia"]} 
        *       },
        *     }
        *   }, 
        *   "markers": [] 
        * }
        * 
        * READER LIMITATION THING
        * if prop matches isness, we must replace it with generic dim,
        * because reader can't handle situations like {is--region:true, region: {$in: [asia]}}
        * so instead we use {is--region:true, geo: {$in: [asia]}}
        */
        findOutIsnessUsingLimitedStructure: function({dim}){
            //looks for patterns like {something: true, ...} in additive section $or
            const extractIsness = (entry) => Object.entries(entry).map( ([k, v]) => v === true ? k : null );
            const candidates = this.config.dimensions?.[dim]?.$or?.map(extractIsness).flat().filter(f => f) || [];
            const unique = [...new Set(candidates)];
            if(unique.length < 1) return null;
            if(unique.length === 1) return unique[0];
            if(unique.length > 1) return unique;
        },

        getLimitedStructureAdditiveSpec({key, dim, prop, isness}){
            if ("is--" + prop === isness) prop = dim; //see reader limitation thing
            return isness 
                ? { [dim]: { "$or": [ { [prop]: { "$in": [key] }, [isness]: true }]} }
                : { [dim]: { "$or": [ { [prop]: { "$in": [key] } }]} }
        },
        getLimitedStructureSubstractiveSpec({key, dim, prop, isness}){
            if ("is--" + prop === isness) prop = dim; //see reader limitation thing
            return isness
                ? { [dim]: { "$nor": [ { [prop]: { "$in": [key] }, [isness]: true }]} }
                : { [dim]: { "$nor": [ { [prop]: { "$in": [key] } }]} }
        },
        

        addUsingLimitedStructure: action("addUsingLimitedStructure", function (vectorisedParams) {  
            const unpackedParams = cartesianPermutations(vectorisedParams);

            for (let params of unpackedParams) {
                if (this.isAlreadyRemovedUsingLimitedStructure(params)){
                    this.substractFromFilterSpec(this.getLimitedStructureSubstractiveSpec(params))
                    this.prune(params);
                } else
                    this.appendToFilterSpec(this.getLimitedStructureAdditiveSpec(params));
            }
        }),
        deleteUsingLimitedStructure: action("deleteUsingLimitedStructure", function (vectorisedParams) {
            const unpackedParams = cartesianPermutations(vectorisedParams);
           
            for (let params of unpackedParams) {
                if (this.isAlreadyAddedUsingLimitedStructure(params)){
                    this.substractFromFilterSpec(this.getLimitedStructureAdditiveSpec(params))
                    this.prune(params);
                } else
                    this.appendToFilterSpec(this.getLimitedStructureSubstractiveSpec(params));
            }
        }),
        clearFilterUsingLimitedStructure: function({dim}){
            this.config.dimensions[dim] = null;
        },
        switchIsenssUsingLimitedStructure: action("switchIsenssUsingLimitedStructure", function({dim, isness}){
            const currentIsness = this.findOutIsnessUsingLimitedStructure({dim});
            
            //hard switch (reset filter to new isness) if soft switch is not possible
            if (!currentIsness || Array.isArray(currentIsness))
                return this.config.dimensions[dim] = {"$or": [{[isness]: true}]};
            
            function swichIsnesOfEveryItemInArray(array){
                if (array)
                    for (let item of array) {
                        delete item[currentIsness];
                        item[isness] = true;

                        //rename prop to dim if it now matches the isness. see reader limitation thing
                        const propMatchingIsness = item[isness.replace("is--","")];
                        if (propMatchingIsness) {
                            item[dim] = propMatchingIsness;
                            delete item[isness.replace("is--","")];
                        }
                    }
            }
            
            //soft switch if isness is singular
            swichIsnesOfEveryItemInArray(this.config.dimensions[dim]?.["$or"]);
            swichIsnesOfEveryItemInArray(this.config.dimensions[dim]?.["$nor"]);
        }),
        isAlreadyAddedUsingLimitedStructure: function({key, dim, prop, isness}) {
            if ("is--" + prop === isness) prop = dim; //see reader limitation thing
            return this.config.dimensions?.[dim]?.$or?.find( f => compare(f, prop, isness) )?.[prop]?.$in?.includes(key);
        },
        isAlreadyRemovedUsingLimitedStructure: function({key, dim, prop, isness}) {
            if ("is--" + prop === isness) prop = dim; //see reader limitation thing
            return this.config.dimensions?.[dim]?.$nor?.find( f => compare(f, prop, isness) )?.[prop]?.$in?.includes(key);
        },

        //TODO this is not pretty and probably can be done better
        //detect sub-clause with $in = [] empty array and kill isness in the subclause
        //thus marking it for deletion by cleanEmptyObjectsAndArrays
        prune({dim, prop, isness}){
            if ("is--" + prop === isness) prop = dim;

            if (this.config.dimensions[dim]?.["$nor"])
                for (let item of this.config.dimensions[dim]["$nor"])
                    if (item[prop] && item[prop]["$in"]?.length === 0) 
                        item[isness] = null;

            if (this.config.dimensions[dim]?.["$or"])
                for (let item of this.config.dimensions[dim]["$or"])
                    if (item[prop] && item[prop]["$in"]?.length === 0) 
                        item[isness] = null;
            cleanEmptyObjectsAndArrays(this.config.dimensions);
        },

        /**
         * Deep-merge a spec into the filter clause, filling out missing steps on the go
         * - For plain objects: recurse.
         * - For arrays
         *   • Try to find an existing entry clause where all keys match
         *   • If found, merge the keys, union-appending $in/$nin parts if present
         *   • Otherwise, push the new clause to array
         *
         * @param spec
         *   A partial `dimension` object, that starts with dim, e.g.
         *     { geo: { $or: [ { is--region: true, country: { $in: ['fin'] } } ] } }
         */
        substractFromFilterSpec(spec){
            this.appendToFilterSpec(spec, "SUBSTRACT");
        },
        appendToFilterSpec(spec, action = "APPEND") {
            function mergeObj(target, src) {
                for (const key of Object.keys(src)) {
                    const val = src[key];

                    //special case where we are actually appending the item
                    if (key === "$in" || key === "$nin") {
                        if (action === "APPEND")
                            target[key] = union(target[key], val);
                        else if (action === "SUBSTRACT")
                            target[key] = substract(target[key], val);
                    }
                    // Array - special function
                    else if (Array.isArray(val)) {
                        target[key] = target[key] || [];
                        mergeArray(target[key], val);
                    }
                    // Nested object - recurse
                    else if (val && typeof val === 'object') {
                        target[key] = target[key] || {};
                        mergeObj(target[key], val);
                    }
                    // Primitives - override
                    else {
                        target[key] = val;
                    }
                }
            }
                
            function mergeArray(targetArr, srcArr) {
                for (const newEntry of srcArr) {
                    // find an existing clause where all matchKeys line up
                    const existing = targetArr.find(oldEntry => getObjectBlueprint(oldEntry) === getObjectBlueprint(newEntry));
                    if (existing)
                        // found matching blueprints! now merge properties one by one
                        // the properties can contain objects or arrays, so recurse
                        mergeObj(existing, newEntry);
                    else
                        // no match → add whole clause
                        targetArr.push(newEntry);
                }
            }
        
            const target = this.config.dimensions;
            mergeObj(target, spec);
        },
  
        
        whereClause(space) {
            let filter = {};

            // dimension filters
            const dimFilters = [];
            space.forEach(dim => {
                if (this.dimensions[dim]) {
                    for (let prop in this.dimensions[dim]) {
                        if (prop == dim || space.length < 2) {
                            // don't include properties which are entity concepts in filter of entity query
                            // https://github.com/Gapminder/big-waffle/issues/52
                            if (space.length > 1 || !this.parent.source.isEntityConcept(prop))
                                dimFilters.push({ [prop]: this.dimensions[dim][prop] });
                        } else { 
                            dimFilters.push({ [dim + '.' + prop]: this.dimensions[dim][prop] });
                        }
                    }
                }
            })

            // specific marker filters
            const markerFilters = [];
            for (let [key, payload] of this.markers) {
                const markerSpace = Object.keys(key);
                if (arrayEquals(markerSpace, space)) {
                    markerFilters.push(key);
                }
            }

            // combine dimension and marker filters
            if (markerFilters.length > 0) {
                filter["$or"] = markerFilters;
                if (dimFilters.length > 0) {
                    filter["$or"].push({ "$and": dimFilters });
                }
            } else {
                if (dimFilters.length > 0) {
                    // clean implicit $and
                    filter = deepmerge.all(dimFilters);
                }
            }

            return filter;
        },
    }
};