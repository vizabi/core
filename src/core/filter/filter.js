import { action, isObservableArray, observable, toJS, trace } from 'mobx';
import { isString, deepmerge, arrayEquals, configValue, removeOnce, createModel } from '../utils';
import { resolveRef } from '../config';

const defaults = {
}

export const type = 'filter';

export function filter(...args) {
    return createModel(filter, ...args)
}

filter.nonObservable = function (config, parent, id) {

    if (!("markers" in config)) config.markers = [];
    if (!("dimensions" in config)) config.dimensions = {};

    return {
        id,
        config,
        parent,
        type,
        get markers() {
            const cfg = resolveRef(this.config.markers).value || {};
            const markers = (isObservableArray(cfg)) ?
                cfg.map(m => [m, true]) :
                Object.entries(cfg);
            return new Map(markers);
        },
        get dimensions() {
            return toJS(this.config.dimensions) || {};
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
        set: action("setFilter", function(marker, payload) {
            if (Array.isArray(marker)) {
                for (const el of marker) this.set(el);
                return;
            }
            const key = this.getKey(marker);
            const cfg = this.config.markers;
            if (payload) {
                if (Array.isArray(this.config.markers)) {
                    this.config.markers = Object.fromEntries(this.config.markers.map(m => [m,true]));
                }
                this.config.markers[key] = configValue(payload);
            } else {
                if (!Array.isArray(this.config.markers)) {
                    if (Object.keys(this.config.markers).length > 0) {
                        this.config.markers[key] = true;
                    } else {
                        this.config.markers = [key]
                    }
                } else if (!this.config.markers.includes(key)) {
                    this.config.markers.push(key);
                }
            }
        }),
        delete: action("deleteFilter", function(marker) {
            if (Array.isArray(marker)) {
                for (const el of marker) this.delete(el)
                return;
            }
            const cfg = this.config.markers;
            const key = this.getKey(marker);
            if (Array.isArray(cfg)) {
                removeOnce(cfg, key);
            } else {
                delete cfg[key];
            }
            return !this.markers.has(key);
        }),
        clear: action("clearFilter", function() {
            this.config.markers = [];
        }),
        toggle: action("toggleFilter", function(marker) {
            if (this.has(marker))
                return this.delete(marker);
            else 
                return this.set(marker);
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
                    for (let prop in this.dimensions[dim]) {
                        if (prop == dim || space.length < 2) {
                            // don't include properties which are entity concepts in filter of entity query
                            // https://github.com/Gapminder/big-waffle/issues/52
                            if (space.length > 1 || !this.parent.source.isEntityConcept(prop))
                                dimFilters.push({ [prop]: this.dimensions[dim][prop] });
                        } else { 
                            dimFilters.push({ [dim + '.' + prop]: this.dimensions[dim][prop] });
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