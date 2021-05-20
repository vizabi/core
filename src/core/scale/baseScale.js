import { isNumeric, parseConfigValue } from "../utils";
import { computed } from "mobx";

const scales = {
    "linear": d3.scaleLinear,
    "log": d3.scaleLog,
    "genericLog": d3.scaleSymlog,
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
  
    function isArrayOneSided(array){
        if (!array) return false;
        if (array.length < 2) return true;
        return !(d3.min(array) <= 0 && d3.max(array) >= 0);
    }

    return {
        config,
        parent,
        name: 'scale',
        defaults: {
            allowedTypes: null,
            clamp: false,
            clampToData: false,
            domain: [0, 1],
            range: [0, 1],
            type: 'linear',
            zeroBaseline: false,
        },
        get zeroBaseline() {
            return (this.config.zeroBaseline ?? this.defaults.zeroBaseline) && !this.isDiscrete(this.data.domain) && isArrayOneSided(this.data.domain);
        },
        get clamp() {
            return this.config.clamp ?? this.defaults.clamp;
        },
        get data() {
            return this.parent.data;
        },
        scaleTypeNoGenLog(domain = this.domain) {
            const concept = this.data.conceptProps;
            let scaleType = null;
            let scale;
            if (scales[this.config.type]) {
                scaleType = this.config.type;
            } else if (concept && concept.scales && (scale = JSON.parse(concept.scales)[0]) && scales[scale]) {
                scaleType = scale;
            } else if (
                concept && ["entity_domain", "entity_set", "string", "boolean"].includes(concept.concept_type)
                || domain.length == 1
            ) {
                if (!this.range.every(isNumeric) || this.range.length != 2)
                    scaleType = "ordinal"
                else
                    scaleType = "point";
            } else if (concept && ["time"].includes(concept.concept_type)) {
                scaleType = "time";
            } else {
                scaleType = this.defaults.type;
            }
            return scaleType;
        },
        get allowedTypes() {
            return this.config.allowedTypes ?? this.defaults.allowedTypes;
        },
        get type() {

            let scaleType = this.scaleTypeNoGenLog();
            let allowedTypes = this.allowedTypes;
            
            if (scaleType == "log" && !isArrayOneSided(this.domain)) {
                scaleType = "genericLog";
            }

            if (allowedTypes && !allowedTypes.includes(scaleType)) {
                console.warn('Scale type not in allowedTypes, please change scale type.', { scaleType, allowedTypes })
                return;
            }
                
            return scaleType;    
        },
        get d3Type() {
            return scales[this.type];
        },
        get range() {
            if (this.config.range != null)
                return this.config.range;

            // default for constant is identity
            if (this.data.isConstant)
                return this.domain;

            // default
            return this.defaults.range;
        },
        set range(range) {
            this.config.range = range;
        },
        get clampToData() { return this.config.clampToData ?? this.defaults.clampToData },
        get domain() {
            if (this.config.domain) {
                return this.config.domain
                    .map(v => parseConfigValue(v, this.data.conceptProps))
                    .map(v => this.clampToData ? this.clampToDomain(v, this.data.domain) : v);
            } else if (this.data.isConstant && this.config.range) {
                return this.range.slice().sort();
            } else if (this.data.domain) {
                // zeroBaseline can override the domain if defined and if data domain is one-sided
                // by replacing the value closest to zero with zero
                // use cases: forcing zero-based bar charts and bubble size
                if (!this.data.isConstant && this.zeroBaseline) {
                    const domain = [...this.data.domain];
                    const closestToZeroIdx = d3.scan(domain.map(Math.abs));
                    domain[closestToZeroIdx] = 0;
                    return domain;
                } else {
                    return this.data.domain;
                }
            } else {
                return this.defaults.domain;
            }      
        },
        set domain(domain) {
            this.config.domain = domain;
        },
        clampToDomain(val, domain = this.domain) {
            if (this.isDiscrete(domain))
                return domain.includes(val) ? val : undefined;
            
            if (val < domain[0]) return domain[0];
            if (val > domain[1]) return domain[1];
            return val;
        },
        d3ScaleCreate() {
            const scale = scales[this.type]();
            if (this.type === "genericLog") {
                //TODO
                //scale.constant(limitsObj.minAbsNear0);
            }
            if(scale.clamp) scale.clamp(this.clamp);
            return scale.domain(this.domain).range(this.range);
        },
        get d3Scale() {
            return this.d3ScaleCreate();
        },
        get zoomed() {
            return this.config.zoomed ? this.config.zoomed.map(c => parseConfigValue(c, this.data.conceptProps)) : this.domain;
        },
        set zoomed(zoomed) {
            this.config.zoomed = zoomed;
        },
        isDiscrete(domain) {
            const scaleType = this.scaleTypeNoGenLog(domain);
            return scaleType == "ordinal" || scaleType == "band" || scaleType == "point";
        },
        domainIncludes(value, domain = this.domain) {
            if ([d3.scaleLinear, d3.scaleLog, d3.scaleSymlog, d3.scaleSqrt, d3.scaleUtc].includes(this.d3Type)) {
                const [min, max] = domain;
                return min <= value && value <= max;
            } else {
                return domain.includes(value);
            }
        },
        disposers: [],
        onCreate() { },
        dispose() {
            for (let disposer of this.disposers) {
                disposer();
            }
        }
    }
}

baseScale.decorate = {
    // allow setting an array to these properties, otherwise getting an infinite loop because values inside array won't be compared
    range: computed.struct,
    domain: computed.struct,
    zoomed: computed.struct,
    allowedTypes: computed.struct
}