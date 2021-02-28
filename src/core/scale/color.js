import { applyDefaults, assign, isString } from "../utils";
import { observable } from "mobx";
import { baseScale } from "./baseScale";
import { palette } from "../palette";
import { resolveRef } from "../vizabi";

const defaultConfig = {
    palette: {}
}

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

            const palette = this.palette;
            if (palette.paletteType == "_continuous") {
                const scaleDomain = this.domain;
                const singlePoint = (scaleDomain[1] - scaleDomain[0] == 0);

                return palette.paletteDomain.map(m => palette.getColor(singlePoint ? palette.palette[palette.paletteDomain[0]] : m));
            }

            return this.domain.map(d => {
                return palette.getColor(d) || palette.getColor("_default");
            });
        },

        get palette() {
            const config = resolveRef(this.config.palette) || defaultConfig.palette;
            return observable(palette(config, this));
        },

        get d3Scale() {
            const scaleDomain = this.domain;
            const domain = this.palette.paletteType == "_continuous" ? 
                this.palette.paletteDomain.map(m => scaleDomain[0] + m / 100 * (scaleDomain[1] - scaleDomain[0]))
                :
                scaleDomain;

            const scale = this.d3ScaleCreate();
            scale.domain(domain);
            
            if (this.isDiscrete()) {
                scale.unknown(this.palette.defaultColor);
            } else {
                if (this.type === "log" || this.type === "genericLog") {
                    const limits = [domain[0], domain[domain.length - 1]];
                    const s = scale.copy()
                        .domain(limits)
                        .range(limits);
                    
                    scale.domain(domain.map(d => s.invert(d)));
                }
                
                scale.interpolate(d3.interpolateRgb.gamma(2.2));
            }
            
            return scale.range(this.range);
        }
    });
}