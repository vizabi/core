import { encodingStore } from "../encoding/encodingStore";

export function encodingCache() {
    const cache = {};
    function fill(cfg, marker) {
        for (const prop in cfg) {
            if (!(prop in cache)) {
                cache[prop] = encodingStore.get(cfg[prop], marker);
            }
        }
    }
    function purge(cfg) {
        for (const prop of Object.keys(cache)) {
            if (!(prop in cfg)) {
                cache[prop].dispose();
                delete cache[prop];
            }
        }
    }
    return { 
        cache,
        update(cfg, marker) {
            fill(cfg, marker);
            purge(cfg);
            return cache;
        }
    }
}