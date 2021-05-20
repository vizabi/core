import { assign, deepmerge } from "../utils";
import { baseScale } from "./baseScale";

const defaults = {
    clamp: true,
    extent: [0, 1],
    range: [0, 20],
    zeroBaseline: true,
}

export function size(config, parent) {
    return observable(size.nonObservable(config, parent));
}

size.nonObservable = function(config, parent) {

    const s = baseScale.nonObservable(config, parent);
    s.defaults = deepmerge(s.defaults, defaults);

    return assign(s, {
        get extent() {
            return this.config.extent || [this.defaults.extent[0], this.data.isConstant ? null : this.defaults.extent[1]];
        },
        set extent(extent) {
            this.config.extent = extent;
        }
    });
}