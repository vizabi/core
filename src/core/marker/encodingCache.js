import { encodingStore } from "../encoding/encodingStore";

export function encodingCache() {
    const cache = {};
    function fill(cache, cfg) {
        for (const prop in cfg) {
            if (!(prop in cache)) {
                cache[prop] = encodingStore.get(cfg[prop], this);
            }
        }
        return cache;
    }
    function purge(cache, cfg) {
        for (const prop of Object.keys(cache)) {
            if (!(prop in cfg)) {
                cache[prop].dispose();
                delete cache[prop];
            }
        }
        return cache;
    }
    return { 
        cache,
        update(cfg) {
            fill(cache, cfg);
            purge(cache, cfg);
            return cache;
        }
    }
}