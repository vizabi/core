import { action, observable } from 'mobx';
import { deepmerge, assign } from "../utils";
import { configurable } from '../configurable'

const defaultConfig = {}

const functions = {
    get selection() {

    },
    isSelected(key) {
        return this.selection.has(key);
    },
    addSelection: action(function(key) {
        this.selection.add(key);
    }),
    removeSelection: action(function(key) {
        this.selection.remove(key);
    }),
    createKey(markerObj) {
        return markerObj[Symbol.for('key')];
    },
    toggleSelection: function(d) {
        const key = this.createKey(d);
        if (this.isSelected(key))
            this.removeSelection(key);
        else
            this.addSelection(key);
    }
}


export function baseSelection(config) {
    config = deepmerge.all([{}, defaultConfig, config]);
    return observable(assign({}, functions, configurable, { config }));
}