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
const joinchar = "-";
const dblescape = escapechar + escapechar;
const joinescape = escapechar + joinchar;
export var esc = str => {
    if (str instanceof Date) str = str.toISOString();
    if (isNumeric(str)) return str;
    return replace(replace(str, escapechar, dblescape), joinchar, joinescape);
}

// jsperf of key-creation options. Simple concat hash + escaping wins: https://jsperf.com/shallow-hash-of-object
// for loop is faster than keys.map().join('-');
// but in Edge, json.stringify is faster
// pre-escaped space would add extra performance
const createDimKeyStr = (dim, dimVal) => {
    if (dimVal instanceof Date) dimVal = dimVal.toISOString();
    //if (!dim || !dimVal) debugger;
    return esc(dim) + joinchar + esc(dimVal);
}
export const createMarkerKey = (row, space = Object.keys(row).sort()) => {
    const l = space.length;

/*    if (l===1)
        return createDimKeyStr(space[0],row[space[0]]+"";
*/

    // space.map(c => createDimKeyStr(row[c]))).join(joinchar);
    var res = (l > 0) ? createDimKeyStr(space[0], row[space[0]]) : '';
    for (var i = 1; i < l; i++) {
        res += joinchar + createDimKeyStr(space[i], row[space[i]]);
    }
    return res
}

export const createKeyFn = (space) => {
    const spaceEsc = space.map(esc);
    const l = space.length;
    return (row) => {
        const parts = [];
        let field, i, j;
        for (i = j = 0; i < l; i++, j+=2) {
            parts[j] = field = spaceEsc[i]; 
            parts[j+1] = esc(row[field]);
        }
        return parts.join(joinchar);
    }
}

export function parseMarkerKey(str) {
    // "remove" escaping by splitting to be able to split on actual joins
    // then, put it back together
    var parts = str.split(dblescape).map(
        s => s.split(joinescape).map(
            s => s.split(joinchar)
        )
    )
    var values = [];
    var val = '';
    for (let i = 0; i < parts.length; i++) {
        for (let j = 0; j < parts[i].length; j++) {
            for (let k = 0; k < parts[i][j].length; k++) {
                // double escape found, glue again with escape char
                if (j === 0 && k === 0) {
                    if (i !== 0) val += escapechar;
                    val += parts[i][j][k];
                } 
                // joinescape found, glue again with join char
                else if (k === 0) {
                    if (j !== 0) val += joinchar;
                    val += parts[i][j][k]
                }
                // actual joinchar found, correct split
                else {
                    values.push(val);
                    val = parts[i][j][k];    
                }
            }
        }
    }
    values.push(val);

    // create key, odd is dim, even is dimension value
    const key = {};
    for (let i = 0; i < values.length; i += 2) {
        key[values[i]] = values[i+1];
    }
    return key;
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

export function mapToObject(map) {
    const result = {};
    for ([key, group] of groupMap) {
        result[key] = group.toJSON();
    }
    return result;
}