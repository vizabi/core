import { assign } from "../utils";
import { baseScale } from "./baseScale";
import * as d3 from "d3-scale-chromatic";
import { observable } from "mobx";

const colors = {
    schemeCategory10: d3.schemeCategory10
}

export function color(config, parent) {
    return observable(color.nonObservable(config, parent));
}

color.nonObservable = function(config, parent) {
    const s = baseScale.nonObservable(config, parent);

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