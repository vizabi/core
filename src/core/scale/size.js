import { scaleSqrt } from "d3-scale";
import { observable } from "mobx";
import { assign } from "../utils";
import { baseScale } from "./baseScale";

export function size(config, parent) {
    return observable(size.nonObservable(config, parent));
}

size.nonObservable = function(config, parent) {

    const s = baseScale.nonObservable(config, parent);

    return assign({ base: s }, s, {
        ordinalScale: "point",
        get range() {
            if (this.config.range != null)
                return this.config.range
            if (this.type == "point")
                return [1, 20];
            return [0, 20];
        },
        get d3Scale() {
            const orig = this.base.d3Scale;
            return orig; // scaleSqrt()
        }
    });
}