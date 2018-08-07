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
    get markers() {
        return new Set(this.config.markers);
    },
    isSelected(d) {
        return this.markers.has(this.getKey(d));
    },
    get anySelected() {
        return this.markers.size !== 0;
    },
    addSelection: function(d) {
        this.changeSelection(d, "add");
    },
    removeSelection: function(d) {
        this.changeSelection(d, "delete");
    },
    // add/remove a bit verbose but better to not alter object (Set)
    // coming from computed property
    changeSelection: action('changeSelection', function(d, changeFn) {
        const newKeys = new Set(this.markers);
        if (Array.isArray(d)) {
            d.map(this.getKey).forEach(key => newKeys[changeFn](key));
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
    get response() {
        return [];
    }
}

export const selection = defaultDecorator({
    base: baseEncoding,
    defaultConfig: defaultConfig,
    functions: functions
});