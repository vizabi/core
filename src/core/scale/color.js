import { applyDefaults, assign } from "../utils";
import { baseScale } from "./baseScale";

const defaultConfig = {}

const colors = {
    schemeCategory10: d3.schemeCategory10
}

export function color(config, parent) {

    applyDefaults(config, defaultConfig);
    const s = baseScale(config, parent);

    return assign(s, {
        get range() {
            const range = this.config.range;
            if (Array.isArray(range))
                return range;
            
            if (isString(range) && colors[range])
                return colors[range];

            if (this.type == "ordinal")
                return d3.schemeCategory10;

            return ["red", "green"];
        }
    });
}