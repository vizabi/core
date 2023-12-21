import { assign, createModel, deepmerge } from "../utils";
import { scale } from "./scale";

const defaults = {
    clamp: true,
    extent: [0, 1],
    range: [0, 20],
    zeroBaseline: true,
    categoricalType: "point",
}

export function size(...args) {
    return createModel(size, ...args)
}

size.nonObservable = function(config, parent) {

    const s = scale.nonObservable(config, parent);
    s.defaults = deepmerge(s.defaults, defaults);

    return assign(s, {
        get extent() {
            return this.config.extent || this.defaults.extent;
        },
        set extent(extent) {
            this.config.extent = extent;
        }
    });
}