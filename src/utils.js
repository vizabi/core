import { autorun } from "mobx";
import { fromPromise } from "mobx-utils";

export const createKey2 = (space, row) => space.map(dim => row[dim]).join('-');
// micro-optimizations below as this is code that runs for each row in data to create key to the row

// string replace functions jsperf: https://jsperf.com/string-replace-methods2
// regexp not here, not fast in any browser
/**
 * Verbose string replace using progressive indexOf. Fastest in Chrome.
 * Does not manipulate input string.
 * @param {*} str Input string
 * @param {*} ndl Needle to find in input string
 * @param {*} repl Replacement string to replace needle with
 */
function replace(str, ndl, repl) {
    var outstr = '',
        start = 0,
        end = 0,
        l = ndl.length;
    while ((end = str.indexOf(ndl, start)) > -1) {
        outstr += str.slice(start, end) + repl;
        start = end + l;
    }
    return outstr + str.slice(start);
}
// fastest in firefox
function replace_sj(str, ndl, repl) {
    return str.split(ndl).join(repl);
}

// precalc strings for optimization
const escapechar = "\\";
const joinchar = "-";
const dblescape = escapechar + escapechar;
const joinescape = escapechar + joinchar;
var esc = str => isNumeric(str) ? str : replace(replace(str, escapechar, dblescape), joinchar, joinescape);

// jsperf of key-creation options. Simple concat hash + escaping wins: https://jsperf.com/shallow-hash-of-object
// for loop is faster than keys.map().join('-');
// but in Edge, json.stringify is faster
// pre-escaped space would add extra performance
export const createMarkerKey = (space, row) => {
    var l = space.length;
    var res = (l > 0) ? esc(space[0]) + joinchar + esc(row[space[0]]) : '';
    for (var i = 1; i < l; i++) {
        var dim = space[i];
        res += '-' + esc(dim) + joinchar + esc(row[dim]);
    }
    return res
}

// end micro-optimizations

export const createKeyStr = (key) => key.map(esc).join('-');

export const isNumeric = (n) => !isNaN(n) && isFinite(n);

export function isString(value) {
    return typeof value == 'string';
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
export function intersect(a, b) {
    return a.filter(e => b.includes(e));
}

// relative complement of A with respect to B
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
export function compose(...parts) {
    return assign({}, ...parts);
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

export function processConfig(config, props) {
    const obj = {};
    props.forEach(p => {
        const prop = (p.fn) ? p.prop : p;
        if (config[prop]) {
            obj[prop] = (p.fn) ? p.fn(config[prop]) : config[prop];
        }
    });
    return obj;
}

export function defaultDecorator({ base, defaultConfig = {}, functions = {} }) {
    if (Array.isArray(functions)) functions = assign({}, ...functions);
    return function decorate(config, parent) {
        applyDefaults(config, defaultConfig);
        delete functions.config;
        base = (base == null) ? (config, parent) => ({ config, parent }) : base;
        return assign(base(config, parent), functions);
    }
}

// code from https://github.com/TehShrike/is-mergeable-object
function isMergeableObject(value) {
    return isNonNullObject(value) &&
        !isSpecial(value)
}

function isNonNullObject(value) {
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
        else if (isMergeableObject(config[prop]) && isMergeableObject(defaults[prop]))
            applyDefaults(config[prop], defaults[prop]);
    })
}