import { action, isObservableArray, toJS } from 'mobx';
import { isString, mapToObj, applyDefaults, deepmerge, arrayEquals } from './utils';
import { resolveRef } from './vizabi';

const defaultConfig = {
    markers: {},
    dimensions: {}
}

export function filter(config = {}, parent) {

    applyDefaults(config, defaultConfig);

    return {
        config,
        parent,
        get markers() {
            const cfg = resolveRef(this.config.markers);
            const markers = (isObservableArray(cfg)) ?
                cfg.map(m => [m, true]) :
                Object.entries(cfg);
            return new Map(markers);
        },
        get dimensions() {
            return toJS(this.config.dimensions);
        },
        has(d) {
            return this.markers.has(this.getKey(d));
        },
        any() {
            return this.markers.size !== 0;
        },
        getPayload(d) {
            return this.markers.get(this.getKey(d));
        },
        set: action("setFilter", function(d, payLoad = true) {
            if (Array.isArray(d)) d.forEach(this.set.bind(this))
            const key = this.getKey(d);
            this.config.markers = mapToObj(this.markers.set(key, payLoad));
        }),
        delete: action("deleteFilter", function(d) {
            if (Array.isArray(d)) d.forEach(this.delete.bind(this))
            const key = this.getKey(d);
            const success = this.markers.delete(key)
            this.config.markers = mapToObj(this.markers);
            return success;
        }),
        clear: action("clearFilter", function() {
            this.config.markers = {};
        }),
        toggle: action("toggleFilter", function(d) {
            const key = this.getKey(d);
            const del = this.delete(key);
            if (!del) this.set(key);
            return !del;
        }),
        getKey(d) {
            return isString(d) ? d : d[Symbol.for('key')];
        },
        whereClause(space) {
            let filter = {};

            // dimension filters
            const dimFilters = [];
            space.forEach(dim => {
                if (this.dimensions[dim]) {
                    for (let key in this.dimensions[dim]) {
                        if (key == dim || space.length < 2) {
                            dimFilters.push({ [key]: this.dimensions[dim][key] });
                        } else { 
                            dimFilters.push({ [dim + '.' + key]: this.dimensions[dim][key] });
                        }
                    }
                }
            })

            // specific marker filters
            const markerFilters = [];
            for (let [key, payload] of this.markers) {
                const markerSpace = Object.keys(key);
                if (arrayEquals(markerSpace, space)) {
                    markerFilters.push(key);
                }
            }

            // combine dimension and marker filters
            if (markerFilters.length > 0) {
                filter["$or"] = markerFilters;
                if (dimFilters.length > 0) {
                    filter["$or"].push({ "$and": dimFilters });
                }
            } else {
                if (dimFilters.length > 0) {
                    // clean implicit $and
                    filter = deepmerge.all(dimFilters);
                }
            }

            return filter;
        },
    }
};