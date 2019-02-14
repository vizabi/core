import { assign, applyDefaults, isString } from "../utils";
import { action } from "mobx";
import { baseEncoding } from "./baseEncoding";

const defaultConfig = {
    starts: {}
}

export function trail(config, parent) {

    applyDefaults(config, defaultConfig);

    const base = baseEncoding(config, parent);

    return assign(base, {
        get show() { return this.config.show },
        get starts() {
            return this.config.starts;
        },
        setTrail: action(function(d) {
            const key = this.getKey(d);
            this.config.starts[key] = d[this.parent.data.concept]; // frame value
            this.data.filter.set(d);
        }),
        deleteTrail: action(function(d) {
            const key = this.getKey(d);
            delete this.config.starts[key]; // frame value
            this.data.filter.delete(d);
        }),
        getKey(d) {
            return isString(d) ? d : d[Symbol.for('key')];
        },
    })
}