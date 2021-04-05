import { action } from "mobx";
import { clamp, configValue, defaultDecorator } from "../utils";
import { filter } from "./filter";

export const trailFilter = defaultDecorator({
    base: filter,
    functions: {
        get encoding() {
            return this.parent.parent;
        },
        set: action("setTrailFilter", function(
            marker, 
            value = marker[this.encoding.groupDim] || this.encoding.frameEncoding.value, 
            limit = this.encoding.limits[this.getKey(marker)]
        ) {
            if (Array.isArray(marker)) {
                for (el of marker) this.set(el);
                return;
            }
            const key = this.getKey(marker);
            if (!this.has(key) && !limit) {
                // add unclamped to starts so limits computed gets recalculated (saves redundant one-off limit calc for this key)
                this.config.markers[key] = configValue(value); 
                limit = this.encoding.limits[key]; 
            }
            // set again if clamped is different from current
            const clamped = clamp(value, limit[0], limit[1]);
            this.config.markers[key] = configValue(clamped);
        })
    }
});