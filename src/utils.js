export const createKey = (space, row) => space.map(dim => row[dim]).join('-');

export const isNumeric = (n) => !isNaN(n) && isFinite(n);

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

// deep merge and helpers
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

export function deepmerge(target, source, options) {
    options = options || {}
    options.arrayMerge = options.arrayMerge || defaultArrayMerge
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