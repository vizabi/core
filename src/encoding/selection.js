import { action, observable } from 'mobx';
import { deepmerge, assign, isString } from "../utils";
import { configurable } from '../configurable'
import { baseEncoding } from './baseEncoding';
import { defaultDecorator, createKey } from '../utils';

const defaultConfig = {
    type: "selection",
    markers: [],
}

const functions = {
    get markerKeys() {
        return new Set(this.config.markers);
    },
    isSelected(d) {
        return this.markerKeys.has(this.getKey(d));
    },
    get anySelected() {
        return this.markerKeys.size !== 0;
    },
    addSelection: action('addSelection', function(d) {
        this.changeSelection(d, "add");
    }),
    removeSelection: action('removeSelection', function(d) {
        this.changeSelection(d, "delete");
    }),
    // add/remove a bit verbose but better to not alter object (Set)
    // coming from computed property
    changeSelection: action('changeSelection', function(d, changeFn) {
        const newKeys = new Set(this.markerKeys);
        if (Array.isArray(d)) {
            d.map(this.getKey).forEach(newKeys[changeFn].bind(newKeys));
        } else {
            newKeys[changeFn](this.getKey(d));
        }
        this.config.markers = Array.from(newKeys);
    }),
    getKey(d) {
        return isString(d) ? d : d[Symbol.for('key')];
    },
    toggleSelection: function(d) {
        const key = this.getKey(d);
        if (this.isSelected(key))
            this.removeSelection(key);
        else
            this.addSelection(key);
    },
    // selections don't have their own data (yet)
    // possibly they take dataMap and add 'selected/highlighted' boolean properties
    get data() {
        return [];
    }
}

export const selection = defaultDecorator({
    base: baseEncoding,
    defaultConfig: defaultConfig,
    functions: functions
});