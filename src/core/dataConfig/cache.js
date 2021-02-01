import { stableStringifyObject, deepclone } from "../utils";

export function makeCache() {
    const cache = new Map();

    const makeKey = function(query) {
        if (query.select.value.length > 1) {
            //console.info('Cache can\'t handle query with more than one select value. Skipping query caching.', query);
            return undefined;
        }
        return stableStringifyObject(query);
    }
    const has = function (query) { return cache.has(makeKey(query)); }
    const get = function (query) { return cache.get(makeKey(query)); }
    const set = function(query, response) {
        if (query.select.value.length > 1) 
            return splitQuery(query).map(q => set(q, response));
        
        const key = makeKey(query);
        return cache.set(key, response);
    }
    const setFromPromise = function(query, promise) {
        return promise.then(response => set(query, response))
    }
    const splitQuery = function(query) {
        return query.select.value.map(concept => {
            const clone = deepclone(query);
            clone.select.value = [concept];
            return clone;
        });
    }

    return {
        has, 
        get, 
        set,
        setFromPromise
    }
}