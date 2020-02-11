import { autorun } from "mobx";
import { fromPromise } from "mobx-utils";

export const isNumeric = (n) => !isNaN(n) && isFinite(n);

export function isString(value) {
    return typeof value == 'string' || value instanceof String;
}

export function isEntityConcept(concept) {
    return ["entity_set", "entity_domain"].includes(concept.concept_type);
}

export function mapToObj(map) {
    const obj = {};
    map.forEach((v, k) => { obj[k] = v });
    return obj;
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

/**
 * Relative complement (difference, B\A) of A with respect to B
 * Everything in B which is not in A. A=[geo,year], B=[geo,year,gender], B\A = [gender]
 * @param {*} a array representing set A
 * @param {*} b array representing set B
 */
export function relativeComplement(a, b) {
    return b.filter(e => !a.includes(e));
}

// returns true if a and b are identical, regardless of order (i.e. like sets)
export function arrayEquals(a, b) {
    const overlap = intersect(a, b);
    return overlap.length == a.length && overlap.length == b.length;
}

// copies properties using property descriptors so accessors (and other meta-properties) get correctly copied
// https://www.webreflection.co.uk/blog/2015/10/06/how-to-copy-objects-in-javascript
// rewrote for clarity and make sources overwrite target (mimic Object.assign)
export function assign(target, ...sources) {
    sources.forEach(source => {
        Object.keys(source).forEach(property => {
            Object.defineProperty(target, property, Object.getOwnPropertyDescriptor(source, property));
        });
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

export function fromPromiseAll(promiseArray) {
    if (promiseArray.every(p.state == "fulfilled"))
        return fromPromise.resolve(promiseArray);
    if (promiseArray.some(p => p.state == "rejected"))
        return fromPromise.reject(promiseArray);
}

export function defaultDecorator({ base, defaultConfig = {}, functions = {} }) {
    if (Array.isArray(functions)) functions = assign({}, ...functions);
    const newType = function decorate(config, parent) {
        applyDefaults(config, defaultConfig);
        delete functions.config;
        base = (base == null) ? (config, parent) => ({ config, parent }) : base;
        return assign(base(config, parent), functions);
    }
    newType.decorate = base.decorate;
    return newType;
}

export function combineStates(states) {
    if (states.some(state => state === "rejected")) return "rejected";
    if (states.every(state => state === "fulfilled")) return "fulfilled";
    return "pending";
}

// code from https://github.com/TehShrike/is-mergeable-object
function isMergeableObject(value) {
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
    return (options.clone !== false && options.isMergeableObject(value)) ?
        deepmerge(emptyTarget(value), value, options) :
        value
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

export function applyDefaults(config, defaults) {
    const defaultProps = Object.keys(defaults);
    defaultProps.forEach(prop => {
        if (!config.hasOwnProperty(prop))
            if (isMergeableObject(defaults[prop]))
                config[prop] = deepclone(defaults[prop]); // object
            else
                config[prop] = defaults[prop]; // non object, e.g. null
        else if (isMergeableObject(defaults[prop]))
            if (isMergeableObject(config[prop]))
                applyDefaults(config[prop], defaults[prop]);
            else
                config[prop] = deepclone(defaults[prop]);
    })
    return config;
}

export function equals(a,b) {
    if (a instanceof Date && b instanceof Date) {
        return a.getTime() === b.getTime();
    }
    return a === b;
}

export function configValue(value, concept) {
    const { concept_type } = concept;
    if (concept_type == "time" && value instanceof Date) {
        return concept.format ? d3.utcFormat(concept.format)(value) : formatDate(value);
    }
    return value;
}


export function range(start, stop, concept) {
    if (concept == "time") concept = "year";
    const interval = d3['utc' + ucFirst(concept)];
    const rangeFn = interval ? interval.range : d3.range;
    return rangeFn(start, stop);
}

export function inclusiveRange(start, stop, concept) {
    const result = range(start, stop, concept);
    result.push(stop);
    return result;
}

const defaultParsers = [
    d3.utcParse('%Y'),
    d3.utcParse('%Y-%m'),
    d3.utcParse('%Y-%m-%d'),
    d3.utcParse('%Y-%m-%dT%HZ'),
    d3.utcParse('%Y-%m-%dT%H:%MZ'),
    d3.utcParse('%Y-%m-%dT%H:%M:%SZ'),
    d3.utcParse('%Y-%m-%dT%H:%M:%S.%LZ')
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
            ? [d3.utcParse(concept.format), ...defaultParsers]
            : defaultParsers;
        return tryParse(valueStr, parsers);
    }

    if (concept_type === "measure") {
        return +valueStr;
    }

    return ""+valueStr;
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

function compose2(f, g) {
    return (...args) => f(g(...args));
}
export function compose(...fns) {
    return fns.reduce(compose2);
}
export function pipe(...fns) {
    return fns.reduceRight(compose2);
}


export function stableStringifyObject(obj) { 
    return JSON.stringify(canonicalObject(obj));
}

function canonicalObject(where) {
    if (!isNonNullObject(where)) 
        return where;
    const keys = Object.keys(where).sort();
    return keys.map(key => ({ [key]: canonicalObject(where[key]) }));
}

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