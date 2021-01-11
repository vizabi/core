import { parseConfigValue } from "../utils";
import { trace, observable } from "mobx";
import * as d3 from "d3-scale";
import { schemeCategory10 as d3SchemeCategory10 } from "d3-scale-chromatic";
import { getDefault, getWithoutDefault, applyDefaults } from "../config/config";

const scales = {
    "linear": d3.scaleLinear,
    "log": d3.scaleLog,
    "sqrt": d3.scaleSqrt,
    "ordinal": d3.scaleOrdinal,
    "point": d3.scalePoint,
    "band": d3.scaleBand,
    "time": d3.scaleUtc
}

export function baseScale(config, parent) {
    return observable(baseScale.nonObservable(config, parent))
}

baseScale.nonObservable = function(config, parent) {

    // console.log('creating new scale for', parent.name);

    applyDefaults(config, {
        range: [0, 1],
        type: 'linear',
        domain: [0, 1]
    })

    return {
        config,
        parent,
        // ordinal, point or band
        ordinalScale: "ordinal",
        get path() {
            return this.parent ? this.parent.path + '.' + name : name;
        },
        name: 'scale',
        get data() {
            return this.parent.data;
        },
        get type() {
            const concept = this.data.conceptProps;
            let scaleType = null;
            let scale;
            const userType = getWithoutDefault(this.config, 'type');
            if (scales[userType])
                scaleType = userType;
            else if (concept && concept.scales && (scale = JSON.parse(concept.scales)[0]) && scales[scale])
                scaleType = scale;
            else if (concept && ["entity_domain", "entity_set", "string"].includes(concept.concept_type))
                scaleType = this.ordinalScale;
            else if (concept && ["time"].includes(concept.concept_type))
                scaleType = "time";
            else
                scaleType = getDefault(this.config, 'type');
            return scaleType;
        },
        get range() {
            if (this.config.range != null)
                return this.config.range

            // default for constant is identity
            if (this.data.isConstant())
                return this.domain;

            // default
            return (this.type == "ordinal") ?
                d3SchemeCategory10 : this.defaults.range;
        },
        set range(range) {
            this.config.range = range;
        },
        get domain() {
            const userDomain = getWithoutDefault(this.config, 'domain');
            return userDomain ? userDomain.map(c => parseConfigValue(c, this.data.conceptProps))
                : this.data.domain ? this.data.domain
                : getDefault(this.config, 'domain');
        },
        clampToDomain(val) {
            const domain = this.domain;
            if (this.type == "ordinal" || this.type == "band" || this.type == "point")
                return domain.includes(val) ? val : undefined;
            
            if (val < domain[0]) return domain[0];
            if (val > domain[1]) return domain[1];
            return val;
        },
        get d3Scale() {
            const scale = scales[this.type]();
            const domain = (this.type == "log" && this.domain[0] == 0) ? [1, this.domain[1]] : this.domain;
            return scale.range(this.range).domain(domain);
        },
    }
}