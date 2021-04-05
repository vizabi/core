import { action } from "mobx";
import { clamp, configValue, defaultDecorator, mapToObj } from "../utils";
import { filter } from "./filter";

export const trailFilter = defaultDecorator({
    base: filter,
    functions: {
        get encoding() {
            return this.parent.parent;
        },
        set: action("setTrailFilter", function(
            d, 
            value = d[this.encoding.groupDim] || this.encoding.frameEncoding.value, 
            limit = this.encoding.limits[this.getKey(d)]
        ) {
            const key = this.getKey(d);
            if (!this.has(key) && !limit) {
                // add unclamped to starts so limits computed gets recalculated (saves redundant one-off limit calc for this key)
                this.config.markers = mapToObj(this.markers.set(key, configValue(value)));
                limit = this.encoding.limits[key]; 
            }
            // set again if clamped is different from current
            const clamped = configValue(clamp(value, limit[0], limit[1]));
            this.config.markers = mapToObj(this.markers.set(key, clamped));
        })
    }
});