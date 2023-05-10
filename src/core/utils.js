import { fromPromise } from "mobx-utils";
import { action, autorun, isObservableArray, observable, onBecomeObserved, onBecomeUnobserved } from "mobx";
import {
    utcParse as d3_utcParse, 
    utcFormat as d3_utcFormat, 
    range as d3_range, 
    utcMonth as d3_utcMonth, 
    utcYear as d3_utcYear, 
    utcDay as d3_utcDay,
    utcMonday as d3_utcMonday,
} from "d3";
import { createFilterFn } from "../dataframe/transforms/filter";

export const isNumeric = (n) => !isNaN(n) && isFinite(n);

export function isString(value) {
    return typeof value == 'string' || value instanceof String;
}

export function isEntityConcept(concept) {
    return ["entity_set", "entity_domain"].includes(concept.concept_type);
}

export function isModel(model) {
    return isNonNullObject(model) && "config" in model;
}

export function isDataSource(model) {
    return isModel(model) && model.type == "dataSource";
}

export function isDataConfig(model) {
    return isModel(model) && model.type == "dataConfig";
}

export function isFilter(model) {
    return isModel(model) && model.type == "filter";
}

export function mapToObj(map) {
    const obj = {};
    map.forEach((v, k) => { obj[k] = v });
    return obj;
}

export function mode(arr = []) {
    return arr.reduce( ( acc, el ) => {
        acc.c[el] = acc.c[el] ? acc.c[el] + 1 : 1
        acc.max = acc.max ? acc.max < acc.c[el] ? el : acc.max : el
        return acc  
    }, { c:{} }).max
}

// intersect of two arrays (representing sets)
// i.e. everything in A which is also in B
export function intersect(a, b) {
    return a.filter(e => b.includes(e));
}

/**
 * Is A a proper subset of B
 * Every A is in B, but A != B
 * @param {*} a 
 * @param {*} b 
 */
export function isProperSubset(a, b) {
    const intersection = intersect(a,b);
    return intersection.length == a.length && intersection.length != b.length;
}

export function subsets(array) { 
    return array.reduce(
        (subsets, value) => [...subsets.map(set => [...set, value]), ...subsets],
        [[]]
    )
}

/**
 * Everything in B which is not in A. Relative complement (difference, B\A) of A with respect to B.
 * A=[geo,year], B=[geo,year,gender], B\A = [gender]
 * @param {Array|Set} a Array/Set representing set A
 * @param {Array|Set} b Array/Set representing set B
 */
export function relativeComplement(a, b) {
    if (a.has) {
        const result = [];
        for (let e of b) if (!a.has(e)) result.push(e);
        return result;
    }
    return b.filter(e => !a.includes(e));
}

export function concatUnique(...arrays) {
    return Array.from(new Set(arrays.flat()));
}

// returns true if a and b are identical, regardless of order (i.e. like sets)
export function arrayEquals(a, b) {
    const overlap = intersect(a, b);
    return overlap.length == a.length && overlap.length == b.length;
}

// copies properties using property descriptors so accessors (and other meta-properties) get correctly copied
// otherwise if you do regular Object.assign it would read directly from the object and execute getters 
// and the return values would be what it assigns. but we want to actually copy getters and setters

// source: https://www.webreflection.co.uk/blog/2015/10/06/how-to-copy-objects-in-javascript
// rewrote for clarity and make sources overwrite target (mimic Object.assign)
export function assign(target, ...sources) {
    sources.forEach(source => {
        Object.defineProperties(target, Object.getOwnPropertyDescriptors(source));
    });
    return target;
}
export function composeObj(...parts) {
    return assign({}, ...parts);
}

export function ucFirst(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// gets a getter accessor from an object and binds it to the object
// used to overload methods when decorating objects
export function getBoundGetter(obj, prop) {
    return Object.getOwnPropertyDescriptor(obj, prop).get.bind(obj);
}

export function moveProperty(oldObj, oldProp, newObj, newProp) {
    Object.defineProperty(newObj, newProp, Object.getOwnPropertyDescriptor(oldObj, oldProp));
}
export function renameProperty(obj, oldProp, newProp) {
    moveProperty(obj, oldProp, obj, newProp)
}

export function fromPromiseAll(promiseColl) {
    const promiseArray = Array.isArray(promiseColl) ? promiseColl : Object.values(promiseColl);
    if (promiseArray.every(p => p.state == "fulfilled"))
        return fromPromise.resolve(promiseColl);
    if (promiseArray.some(p => p.state == "rejected"))
        return fromPromise.reject(promiseColl);
    return fromPromise((res, rej) => { });
}

/**
 * Checks all states in parallel
 * @param {string[]} states 
 * @returns 
 */
export function combineStates(states) {
    if (states.some(state => state === "rejected")) return "rejected";
    if (states.every(state => state === "fulfilled")) return "fulfilled";
    return "pending";
}

/**
 * Checks all states sequantially (only check-trigger next state if previous is fulfilled)
 * @param {function[]} states state getters
 * @returns 
 */
export function combineStatesSequential(states) {
    if (!states.every(state => typeof state == 'function')) {
        throw new Error("Every state given to combineStatesSequential should be wrapped in a getter function.")
    }
    for (let state of states) {
        // state getter allows us to only read state (and thus trigger upstream computeds) when earlier states are fulfilled
        state = state()
        if (state == 'pending') return 'pending';
        if (state == 'rejected') return 'rejected';
    }
    return 'fulfilled';
}

// code from https://github.com/TehShrike/is-mergeable-object
export function isMergeableObject(value) {
    return isNonNullObject(value) &&
        !isSpecial(value)
}

export function isNonNullObject(value) {
    return !!value && typeof value === 'object'
}

function isSpecial(value) {
    var stringValue = Object.prototype.toString.call(value)

    return stringValue === '[object RegExp]' ||
        stringValue === '[object Date]' ||
        isObservableArray(value) ||
        isReactElement(value)
}

// see https://github.com/facebook/react/blob/b5ac963fb791d1298e7f396236383bc955f916c1/src/isomorphic/classic/element/ReactElement.js#L21-L25
var canUseSymbol = typeof Symbol === 'function' && Symbol.for
var REACT_ELEMENT_TYPE = canUseSymbol ? Symbol.for('react.element') : 0xeac7

function isReactElement(value) {
    return value.$$typeof === REACT_ELEMENT_TYPE
}

// c merge and helpers
// code from https://github.com/KyleAMathews/deepmerge
function emptyTarget(val) {
    return Array.isArray(val) ? [] : {}
}

function cloneUnlessOtherwiseSpecified(value, options) {
    return (options.clone !== false && options.isMergeableObject(value)) 
        ? deepmerge(emptyTarget(value), value, options) 
        : Object.prototype.toString.call(value) == '[object Date]'
            ? new Date(value.getTime())
            : value;
}

function defaultArrayMerge(target, source, options) {
    return target.concat(source).map(function(element) {
        return cloneUnlessOtherwiseSpecified(element, options)
    })
}

function mergeObject(target, source, options) {
    var destination = {}
    if (options.isMergeableObject(target)) {
        Object.keys(target).forEach(function(key) {
            destination[key] = cloneUnlessOtherwiseSpecified(target[key], options)
        })
    }
    Object.keys(source).forEach(function(key) {
        if (!options.isMergeableObject(source[key]) || !target[key]) {
            destination[key] = cloneUnlessOtherwiseSpecified(source[key], options)
        } else {
            destination[key] = deepmerge(target[key], source[key], options)
        }
    })
    return destination
}

const overwriteMerge = (destinationArray, sourceArray, options) => sourceArray

export function deepmerge(target, source, options) {
    options = options || {}
    options.arrayMerge = options.arrayMerge || overwriteMerge
    options.isMergeableObject = options.isMergeableObject || isMergeableObject

    var sourceIsArray = Array.isArray(source)
    var targetIsArray = Array.isArray(target)
    var sourceAndTargetTypesMatch = sourceIsArray === targetIsArray

    if (!sourceAndTargetTypesMatch) {
        return cloneUnlessOtherwiseSpecified(source, options)
    } else if (sourceIsArray) {
        return options.arrayMerge(target, source, options)
    } else {
        return mergeObject(target, source, options)
    }
}

deepmerge.all = function deepmergeAll(array, options) {
    if (!Array.isArray(array)) {
        throw new Error('first argument should be an array')
    }

    return array.reduce(function(prev, next) {
        return deepmerge(prev, next, options)
    }, {})
}

export function deepclone(object) {
    return deepmerge({}, object);
}

export function createModel(modelType, config, parent, id) {
    //suffix for debugging
    let nameSuffix = id ? '-' + id : parent?.name ? '-' + parent.name : '';
    let model = observable(
        //actual constructor
        modelType.nonObservable(config, parent, id), 
        //decorators
        modelType.decorate,
        //extra options: name of observable
        { name: (modelType.name || config.modelType || 'base') + nameSuffix }
    );
    //lifecycle function
    if (model.onCreate) model.onCreate();
    return model;
}

export function defaultDecorator({ base, renameProperties = {}, defaultConfig = {}, functions = {} }) {
    if (Array.isArray(functions)) functions = assign({}, ...functions);
    const newType = function (config, parent, id) {
        return createModel(newType, config, parent, id)
    }
    newType.nonObservable = function(config, parent, id) {
        applyDefaults(config, defaultConfig);
        delete functions.config;
        if (!base) base = (config, parent) => ({ config, parent });
        const baseObj = base.nonObservable(config, parent, id);
        for (const prop in renameProperties) {
            renameProperty(baseObj, prop, renameProperties[prop]);
        }
        return assign(baseObj, functions);
    }
    newType.decorate = base.decorate;
    return newType;
}

export const applyDefaults = action('applyDefaults', function applyDefaults(config, defaults) {
    const defaultProps = Object.keys(defaults);
    defaultProps.forEach(prop => {
        if (!config.hasOwnProperty(prop)) {
            if (isMergeableObject(defaults[prop]))
                config[prop] = deepclone(defaults[prop]); // object
            else
                config[prop] = defaults[prop]; // non object, i.e. value
        } else if (isMergeableObject(defaults[prop])) {
            if (isMergeableObject(config[prop]))
                applyDefaults(config[prop], defaults[prop]);
        }
    })
    return config;
})

export function equals(a,b) {
    if (a instanceof Date && b instanceof Date) {
        return a.getTime() === b.getTime();
    }
    return a === b;
}

export function clamp(value, min, max) {
    if (Array.isArray(min))
        [min, max] = min;
    if (value > max)
        return max;
    if (value < min)
        return min;
    return value;
}

export function configValue(value, concept) {
    if (value instanceof Date) {
        return concept?.format ? d3_utcFormat(concept.format)(value) : formatDate(value);
    }
    return ""+value;
}


export function range(start, stop, intervalSize) {
    return interval(intervalSize).range(start, stop);
}

export const POSSIBLE_INTERVALS = ["year", "month", "day", "week", "quarter"];

export function interval(intervalSize) {
    switch (intervalSize) {
        case "year": return d3_utcYear;
        case "day": return d3_utcDay;
        case "month": return d3_utcMonth;
        case "week": return d3_utcMonday;
        case "quarter": return d3_utcMonth.every(3);
        default: return {
            //not a time interval
            offset: (n, d) => isNumeric(n) && isNumeric(d) ? n + d : console.error("Can't offset using non-numeric values", { n, d }),
            range: d3_range,
            floor: Math.floor,
            ceil: Math.ceil,
            round: Math.round
        };
    }
}

export function inclusiveRange(start, stop, intervalSize) {
    if (!start || !stop) return [];
    return range(start, stop, intervalSize).concat(stop);
}

const defaultParsers = [
    d3_utcParse('%Y'),
    d3_utcParse('%Y-%m'),
    d3_utcParse('%Y-%m-%d'),
    d3_utcParse('%Yw%V'),
    d3_utcParse('%Yq%q'),
    d3_utcParse('%Y-%m-%dT%HZ'),
    d3_utcParse('%Y-%m-%dT%H:%MZ'),
    d3_utcParse('%Y-%m-%dT%H:%M:%SZ'),
    d3_utcParse('%Y-%m-%dT%H:%M:%S.%LZ')
];

function tryParse(timeString, parsers) {
    for (let i = 0; i < parsers.length; i++) {
      let dateObject = parsers[i](timeString);
      if (dateObject) return dateObject;
    }
    console.warn('Could not parse time string ' + timeString)
    return null;
}

/**
 * Parses string `valueStr` to different type, depending on `concept` type. 
 * Type `time` is parsed to `Date`, `measure` to `number`, any other to string. 
 * If `valueStr` is not a string, it is returned as is.
 * 
 * @param {string} valueStr String to parse
 * @param {Object} concept Concept object of which valueStr is a value
 */
export function parseConfigValue(valueStr, concept) {
    if (!isString(valueStr)) return valueStr;

    const { concept_type } = concept;

    if (concept_type === "time") {
        let parsers = concept.format 
            ? [d3_utcParse(concept.format), ...defaultParsers]
            : defaultParsers;
        return tryParse(valueStr, parsers);
    }

    if (concept_type === "measure") {
        return +valueStr;
    }

    return ""+valueStr;
}

export function autoFormat(o) {
    if (o instanceof Date)
        return formatDate(o)
    return ""+o;
}

function formatDate(date) {
    var month = date.getUTCMonth(),
        day = date.getUTCDate(),
        hours = date.getUTCHours(),
        minutes = date.getUTCMinutes(),
        seconds = date.getUTCSeconds(),
        milliseconds = date.getUTCMilliseconds();
    return isNaN(date) ? "Invalid Date"
        : milliseconds ? formatFullDate(date) + "T" + pad(hours, 2) + ":" + pad(minutes, 2) + ":" + pad(seconds, 2) + "." + pad(milliseconds, 3) + "Z"
        : seconds ? formatFullDate(date) + "T" + pad(hours, 2) + ":" + pad(minutes, 2) + ":" + pad(seconds, 2) + "Z"
        : minutes || hours ? formatFullDate(date) + "T" + pad(hours, 2) + ":" + pad(minutes, 2) + "Z"
        : day !== 1 ? formatFullDate(date)
        : month ? formatYear(date.getUTCFullYear(), 4) + "-" + pad(date.getUTCMonth() + 1, 2)
        : formatYear(date.getUTCFullYear(), 4);
}

function formatFullDate(date) {
    return formatYear(date.getUTCFullYear(), 4) + "-" + pad(date.getUTCMonth() + 1, 2) + "-" + pad(date.getUTCDate(), 2);
}

function formatYear(year) {
    return year < 0 ? "-" + pad(-year, 6)
        : year > 9999 ? "+" + pad(year, 6)
        : pad(year, 4);
}

function pad(value, width) {
    var s = value + "", length = s.length;
    return length < width ? new Array(width - length + 1).join(0) + s : s;
}
    
export const defer = setTimeout;
export const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function compose2(f, g) {
    return (...args) => f(g(...args));
}
export function compose(...fns) {
    return fns.reduce(compose2);
}
export function pipe(...fns) {
    return fns.reduceRight(compose2);
}

/**
 * Creates a stable, unique string representing the object, circumventing the unordered nature of object properties
 * @param {Object} obj 
 * @returns {String} Stable string representation of object
 */
export function stableStringifyObject(obj) { 
    return JSON.stringify(canonicalObject(obj));
}

/**
 * Recursively replace any object by an array where each element is on of the object's properties, sorted by the property name.
 * Can be used as stable input for hashing objects, circumventing the unordered nature of object properties.
 * @param {Object} where 
 * @returns {Array}
 */
function canonicalObject(where) {
    if (!isNonNullObject(where)) 
        return where;
    const keys = Object.keys(where).sort();
    return keys.map(key => ({ [key]: canonicalObject(where[key]) }));
}

/**
 * Function for Array#sort which doesn't convert values to strings. Dates will be converted to integers and thus sort chronologically.
 * @param {*} a 
 * @param {*} b 
 * @returns 
 */
export const sortDateSafe = (a, b) => a > b ? 1 : a < b ? -1 : 0; 

/**
 * Returns value for `key` in `map`. If `key` not in map, first create new value using `create` getter function and set it to `key`.
 * @param {Map} map Map to get from
 * @param {Any} key Key to map
 * @param {Function} create Function which returns new value for new keys
 */
export function getOrCreate(map, key, create) {
    let value;
    if (map.has(key))
        value = map.get(key);
    else {
        value = create();
        map.set(key, value);
    }
    return value;
}

/**
 * Return filtered object(shallow cloned)
 * @param {Object} obj 
 * @param {Function} filter
 */
export function filterObject(obj, filter) {
    let result = {}, key;

    for (key in obj) {
        if (obj.hasOwnProperty(key) && filter(obj[key], key)) {
            result[key] = obj[key];
        }
    }

    return result;
}

export function createConceptFilterFn(filterSpec = {}) {
    if (Object.keys(filterSpec) == 0) {
        return () => true;
    }
    return createFilterFn(filterSpec);
}

export function createSpaceFilterFn(filterSpec = {}, dataConfig) {
    if (Object.keys(filterSpec) == 0) {
        return () => true;
    }
    const filterFn = createFilterFn(filterSpec);
    const source = dataConfig.source;
    return function filter(spaceArray) {
        return spaceArray
            .map(dim => typeof dim != 'object' ? source.getConcept(dim) : dim)
            .every(filterFn);
    }
}

export function pickGetters(object, keys) {
    const result = {};
    for (const key of keys) {
        if (key in object)
            Object.defineProperty(result, key, Object.getOwnPropertyDescriptor(object, key));
    }
    return result;
}


export function getConceptsCatalog(concepts, dataConfig, maxDepth) {
    const promises = [];
    const result = {}
    const source = dataConfig.source;
    for (const conceptId of concepts) {
        const concept = source.getConcept(conceptId);
        result[conceptId] = {
            concept
        };
        if (source.isEntityConcept(conceptId)) {
            const setMembershipFlags = source.availability.data
                .map(m => m.value)
                .filter(f => f.includes("is--") || f == "un_state");

            const entityQuery = dataConfig.createQuery({ 
                space: [conceptId],  
                concept: ["name", "rank", ...setMembershipFlags],
                locale: dataConfig.locale,
                filter: null,
                source
            })
            promises.push(source.query(entityQuery).then(response => {
                result[conceptId]['entities'] = response.forQueryKey();
            }));
            if (maxDepth && maxDepth > 0) {
                const props = source.availability.keyValueLookup.get(conceptId).keys();
                const propDetails = getConceptsCatalog(props, dataConfig, maxDepth - 1);
                promises.push(propDetails.then(response => {
                    result[conceptId]['properties'] = response;
                }));
            }
        }
    }
    return Promise.all(promises).then(() => result);
}

export function removeOnce(arr, value) {
    let index = arr.indexOf(value);
    if (index > -1) {
        arr.splice(index, 1);
    }
    return arr;
}

export function lazyAsync(asyncFn, obsObj, obsProp) {
    let lazyDisposer;
    const dispObs = onBecomeObserved(obsObj, obsProp, () => {
        lazyDisposer = autorun(asyncFn);
    })
    const dispUnobs = onBecomeUnobserved(obsObj, obsProp, () => {
        lazyDisposer();
    });
    return () => {
        dispObs();
        dispUnobs();
        lazyDisposer?.();
    }
}

export function isIterable(obj) {
  // checks for null and undefined
  if (obj == null) {
    return false;
  }
  return typeof obj[Symbol.iterator] === 'function';
}

export function stepBeforeInterpolator(startVal, endVal) {
    if (typeof startVal === "object") {
        const jsonStartVal = JSON.stringify(startVal);
        const jsonEndtVal = JSON.stringify(endVal);
        return t => JSON.parse(t < 1 ? jsonStartVal : jsonEndtVal);
    } else return t => t < 1 ? startVal : endVal;
}
