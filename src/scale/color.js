import { applyDefaults, assign } from "../utils";
import { base } from "./base";

const defaultConfig = {}

const colors = {
    schemeCategory10: d3.schemeCategory10
}

export function color(config, parent) {

    applyDefaults(config, defaultConfig);
    const s = base(config, parent);

    return assign(s, {
        get range() {
            const range = this.config.range;
            if (isString(range) && colors[range]) {
                return colors[range];
            } else if (Array.isArray(range)) {
                return range;
            }

            return (this.type == "ordinal") ?
                d3.schemeCategory10 : ["red", "green"];
        }
    });
}