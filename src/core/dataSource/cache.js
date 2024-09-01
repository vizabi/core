import { stableStringifyObject, deepclone } from "../utils";

export function makeCache() {
    const cache = new Map();

    const makeKey = function(query) {
        return stableStringifyObject(query);
    }
    const has = function (query) { return cache.has(makeKey(query)); }
    const get = function (query) { return cache.get(makeKey(query)); }
    const set = function(query, promise) {
        if (query.select.value.length > 1) {
            splitQuery(query).map(q => set(q, promise));
        }
        const key = makeKey(query);
        return cache.set(key, promise);
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
        set
    }
}