import { applyDefaults, assign } from "../utils";
import { baseScale } from "./baseScale";

const defaultConfig = {
    zeroBaseline: true,
    clamp: true,
    range: [0, 20]
}

const defaults = {
    extent: [0, 1]
}

export function size(config, parent) {

    applyDefaults(config, defaultConfig);
    const s = baseScale(config, parent);

    return assign(s, {
        ordinalScale: "point",
        get extent() {
            return this.config.extent || [defaults.extent[0], this.data.isConstant() ? null : defaults.extent[1]];
        },
        set extent(extent) {
            this.config.extent = extent;
        },
        get range() {
            if (this.config.range != null)
                return this.config.range
            if (this.type == "point")
                return [1, 20];
            return [0, 20];
        }
    });
}