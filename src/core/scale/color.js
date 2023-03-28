import { applyDefaults, assign, createModel, isString } from "../utils";
import { observable } from "mobx";
import { scale } from "./scale";
import { palette } from "../palette";
import { resolveRef } from "../config";
import {schemeCategory10 as d3_schemeCategory10, interpolateRgb as d3_interpolateRgb} from "d3";

const defaultConfig = {
}

const colors = {
    schemeCategory10: d3_schemeCategory10
}

export function color(...args) {
    return createModel(color, ...args)
}

color.nonObservable = function(config, parent) {
    
    applyDefaults(config, defaultConfig);

    const s = scale.nonObservable(config, parent);

    return assign(s, {
        calcRange(domain = this.domain) {
            const range = this.config.range;
            if (Array.isArray(range))
                return range;
            
            if (isString(range) && colors[range])
                return colors[range];

            const palette = this.palette;
            if (palette.paletteType == "_continuous") {
                const scaleDomain = domain;
                const singlePoint = (scaleDomain[1] - scaleDomain[0] == 0);

                return palette.paletteDomain.map(m => palette.getColor(singlePoint ? palette.palette[palette.paletteDomain[0]] : m));
            }

            return domain.map((d, i) => {
                return palette.getColor(d) || palette.getColorByIndex(i) || palette.defaultColor;
            });
        },

        get isPattern() {
            return !!(this.domain && this.domain.length && this.domain.some(color => color && color.length && color[0] == "<"));
        },

        get palette() {
            const config = resolveRef(this.config.palette).value || defaultConfig.palette;
            return observable(palette(config, this));
        },

        get d3Scale() {

            const scale = this.d3ScaleCreate();
            let domain = scale.domain();

            if (this.palette.paletteType == "_continuous") { 
                domain = this.palette.paletteDomain.map(m => +domain[0] + m / 100 * (domain[1] - domain[0]))
            }
            
            if (this.isDiscrete()) {
                scale.unknown(this.palette.defaultColor);
            } else {
                if (this.type === "log" || this.type === "genericLog") {
                    const limits = [domain[0], domain[domain.length - 1]];
                    const s = scale.copy()
                        .domain(limits)
                        .range(limits);
                    
                    domain = domain.map(d => s.invert(d));
                }
                
                scale.interpolate(d3_interpolateRgb.gamma(2.2));
            }
            
            scale.domain(domain);
            return scale;
        }
    });
}