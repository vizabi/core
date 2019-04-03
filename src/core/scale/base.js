import { applyDefaults, parseConfigValue } from "../utils";

const scales = {
    "linear": d3.scaleLinear,
    "log": d3.scaleLog,
    "sqrt": d3.scaleSqrt,
    "ordinal": d3.scaleOrdinal,
    "point": d3.scalePoint,
    "band": d3.scaleBand
}


const defaultConfig = {
    domain: null,
    range: null,
    type: null
}

export function base(config = {}, parent) {

    applyDefaults(config, defaultConfig);

    return {
        config,
        parent,
        // ordinal, point or band
        ordinalScale: "ordinal",
        get data() {
            return this.parent.data;
        },
        get type() {
            const concept = this.data.conceptProps;
            let scaleType = null;
            let scale;
            if (scales[this.config.type])
                scaleType = this.config.type;
            else if (concept && concept.scales && (scale = JSON.parse(concept.scales)[0]) && scales[scale])
                scaleType = scale;
            else if (concept && ["entity_domain", "entity_set", "string"].includes(concept.concept_type))
                scaleType = this.ordinalScale;
            else
                scaleType = "linear";
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
                d3.schemeCategory10 : [0, 1];
        },
        set range(range) {
            this.config.range = range;
        },
        get domain() {
            return this.config.domain 
                ? this.config.domain.map(c => parseConfigValue(c, this.data.conceptProps))
                : this.data.domain;
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