import { encodingStore } from "../encoding/encodingStore";

//encoding cache makes sure encodings are not recreated every time

export function encodingCache() {
    const cache = {};
    function fill(cfg, marker) {
        for (const prop in cfg) {
            if (!(prop in cache)) {
                cache[prop] = encodingStore.get(cfg[prop], marker, prop);
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