export function getIter(iter) {
    if ("values" in iter && typeof iter.values === "function")
        return iter.values();
    return iter;
}

export function isDataFrame(data) {
    return "hasByObjOrStr" in data && typeof data.hasByObjOrStr === "function";
}

export function isGroupedDataFrame(data) {
    return "descendantKeys" in data && Array.isArray(data.descendantKeys);
}

export function isIterable(obj) {
    return Symbol.iterator in obj;
}

// returns true if a and b are identical, regardless of order (i.e. like sets)
export function arrayEquals(a, b) {
    const overlap = intersect(a, b);
    return overlap.length == a.length && overlap.length == b.length;
}

// intersect of two arrays (representing sets)
// i.e. everything in A which is also in B
export function intersect(a, b) {
    return a.filter(e => b.includes(e));
}

export function isNonNullObject(value) {
    return !!value && typeof value === 'object'
}

export function normalizeKey(key) {
    return key.slice(0).sort();
}

export const createKeyStr = (key) => normalizeKey(key).map(esc).join('-');

export const createKey2 = (space, row) => space.map(dim => row[dim]).join('-');
// micro-optimizations below as this is code that runs for each row in data to create key to the row

export const isNumeric = (n) => !isNaN(n) && isFinite(n);

// TODO: probably use different replace function, long version in jsperf
// string replace functions jsperf: https://jsperf.com/string-replace-methods
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
    //if (!str && str !== "" || str === undefined) debugger;
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

function isString(str) {
    typeof str === "string";
}

// precalc strings for optimization
const escapechar = "\\";
const joinchar = "¬";
const dblescape = escapechar + escapechar;
const joinescape = escapechar + joinchar;

const dateCache = new Map();
function dateToCachedString(d) {
    let int = d.getTime();
    if (!dateCache.has(int)) {
        dateCache.set(int, d.toISOString())
    }
    return dateCache.get(int);
}

export function esc (str) {  
    if (str instanceof Date) return dateToCachedString(str); // .getTime();
    //if (isNumeric(str)) return str;
    //return replace(replace(str, escapechar, dblescape), joinchar, joinescape);
    return str; 
}

export const createKeyFn = (space) => {
    space = normalizeKey(space);
    const l = space.length;
    return (row) => {
        const parts = [];
        for (let i = 0; i < l; i++) {
            parts[i] = esc(row[space[i]]);
        }
        return parts.join(joinchar);
    }
}

// end micro-optimizations

export function pick(object, keys) {
    return keys.reduce((obj, key) => {
        if (object[key]) {
            obj[key] = object[key];
        }
        return obj;
        }, {});
}

export function unique(...arrays) {
    const uniqueSet = new Set(arrays.flat());
    return Array.from(uniqueSet);
}

/**
 * Creates an auto-curried function out of the supplied function. An autocurried function can be applied either in a curried fashion or normally.
 * E.g. fn(a,b,c) can be called like fn(a)(b)(c) or f(a, b)(c) or f(a,b,c) or f(a)(b, c) or f()(a,b,c) etc
 * @param {Function} fn 
 * @returns {Function} autocurried
 */
export function curry(fn) {
    /* need to specify arity this way since Function.length 
     * does not include rest arguments (...rest) which are used 
     * in the partial function (which is curried too ) 
     */
    function curryN(arity, fn) {
        return function curried(...args) {
            if (arity < args.length) {
                function partial(...otherArgs) {
                    fn(...args, ...otherArgs);
                }
                return curryN(arity - args.length, partial);
            } else {
                return fn(...args);
            }
        }
    }
    return curryN(fn.length, fn);

    /* identical big-arrow implementation
    const curryN = (arity, fn) => (...args) => 
        arity < args.length
            ? curryN(arity - args.length, (...restArgs) => fn(...args, ...restArgs))
            : fn(...args) 

    return curryN(fn.length, fn);
    */
}

function compose2(f, g) {
    return (...args) => f(g(...args));
}
export function compose(...fns) {
    return fns.reduce(compose2);
}
export function pipe(...fns) {
    return fns.reduceRight(compose2);
}

export function rangeIndex(index = 0) {
    return (row, key) => index++;
}

export function mapToObject(group) {
    const result = {};
    for ([key, member] of group) {
        result[key] = member.toJSON();
    }
    return result;
}