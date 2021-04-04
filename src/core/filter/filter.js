import { action, isObservableArray, observable, toJS, trace } from 'mobx';
import { isString, mapToObj, applyDefaults, deepmerge, arrayEquals, configValue, deepclone } from '../utils';
import { resolveRef } from '../config';

const defaultConfig = {
    markers: {},
    dimensions: {}
}

export const type = 'filter';

export function filter(config, parent, id) {
    return observable(
        filter.nonObservable(observable(config), parent, id), 
        filter.decorate
    );
}

filter.nonObservable = function (config, parent, id) {

    if (!"markers" in config) config.markers = {};
    if (!"dimensions" in config) config.dimensions = {};

    return {
        id,
        config,
        parent,
        type,
        get markers() {
            const cfg = resolveRef(this.config.markers) || {};
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
        set: action("setFilter", function(d, payload) {
            if (Array.isArray(d)) d.forEach(this.set.bind(this))
            const key = this.getKey(d);
            this.config.markers = mapToObj(this.markers.set(key, configValue(payload)));
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
            const del = this.delete(d);
            if (!del) this.set(d);
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