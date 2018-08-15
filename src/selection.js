import { action, isObservableArray } from 'mobx';
import { isString, mapToObj } from './utils';
import { resolveRef } from './vizabi';

export function selection(config = {}, parent) {
    return {
        parent,
        config,
        get markers() {
            if (isString(this.config.markers.ref))
                return resolveRef(this.config.markers);
            const markers = (isObservableArray(this.config.markers)) ?
                this.config.markers.map(m => [m, true]) :
                Object.entries(this.config.markers);
            return new Map(markers);
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
        set: action(function(d, payLoad = true) {
            if (Array.isArray(d)) d.forEach(this.set.bind(this))
            const key = this.getKey(d);
            this.config.markers = mapToObj(this.markers.set(key, payLoad));
        }),
        delete: action(function(d) {
            if (Array.isArray(d)) d.forEach(this.delete.bind(this))
            const key = this.getKey(d);
            const success = this.markers.delete(key)
            this.config.markers = mapToObj(this.markers);
            return success;
        }),
        toggle(d) {
            const key = this.getKey(d);
            const del = this.delete(key);
            if (!del) this.set(key);
            return !del;
        },
        getKey(d) {
            return isString(d) ? d : d[Symbol.for('key')];
        }
    }
};