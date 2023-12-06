import { createModel, isNumeric, parseConfigValue, sortDateSafe } from "../utils";
import { computed } from "mobx";
import {
    scaleLinear as d3_scaleLinear,
    scaleLog as d3_scaleLog,
    scaleSymlog as d3_scaleSymlog,
    scaleSqrt as d3_scaleSqrt,
    scaleOrdinal as d3_scaleOrdinal,
    scalePoint as d3_scalePoint,
    scaleBand as d3_scaleBand,
    scaleUtc as d3_scaleUtc,
    leastIndex as d3_leastIndex,
    min as d3_min,
    max as d3_max,
} from "d3";

const scales = {
    "linear": d3_scaleLinear,
    "log": d3_scaleLog,
    "genericLog": d3_scaleSymlog,
    "sqrt": d3_scaleSqrt,
    "ordinal": d3_scaleOrdinal,
    "point": d3_scalePoint,
    "band": d3_scaleBand,
    "time": d3_scaleUtc,
    "rank": d3_scaleLinear
}

export function scale(...args) {
    return createModel(scale, ...args)
}

scale.nonObservable = function(config, parent) {
  
    function isArrayOneSided(array){
        if (!array) return false;
        if (array.length < 2) return true;
        return !(d3_min(array) <= 0 && d3_max(array) >= 0);
    }

    return {
        config,
        parent,
        name: 'scale',
        defaults: {
            allowedTypes: null,
            clamp: false,
            clampDomainToData: false,
            orderDomain: true,
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
        get orderDomain() {
            return this.config.orderDomain ?? this.defaults.orderDomain;
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
                const range = this.calcRange(domain);
                if (!range.every(isNumeric) || range.length != 2)
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
        calcRange(domain = this.domain) {
            if (this.config.range != null)
                return this.config.range;

            // default
            return this.defaults.range;
        }, 
        get range() {
            return this.calcRange();
        },
        get clampDomainToData() { return this.config.clampDomainToData ?? this.defaults.clampDomainToData },
        get isSameAsFrameEncScale() {
            const enc = this.parent;
            const marker = this.parent.marker;
            const frame = marker?.encoding?.frame;

            return enc.config.modelType !== "frame" && frame && enc.data.concept === frame.data.concept;
        },
        get domain() {
            let domain;
            if (this.config.domain) {
                domain = this.config.domain
                    .map(v => parseConfigValue(v, this.data.conceptProps))
                    .map(v => this.clampDomainToData ? this.clampToDomain(v, this.data.domain) : v);
            } else if (this.data.isConstant) {
                domain = [this.data.constant];
            } else if (this.isSameAsFrameEncScale) {
                domain = this.parent.marker.encoding.frame.scale.domain;
            } else if (this.config.type == "rank" ) {
                domain = [0, this.parent.totalTrackNumber];
            } else if (this.data.domain) {
                domain = this.data.domain;
                // zeroBaseline can override the domain if defined and if data domain is one-sided
                // by replacing the value closest to zero with zero
                // use cases: forcing zero-based bar charts and bubble size
                if (this.zeroBaseline) {
                    domain = [...domain];
                    const closestToZeroIdx = d3_leastIndex(domain.map(Math.abs));
                    domain[closestToZeroIdx] = 0;
                } 
            } else {
                domain = this.defaults.domain;
            }     
            return this.isDiscrete(domain) && this.orderDomain ? [...domain].sort(sortDateSafe) : domain;
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
            if ([d3_scaleLinear, d3_scaleLog, d3_scaleSymlog, d3_scaleSqrt, d3_scaleUtc].includes(this.d3Type)) {
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

scale.decorate = {
    // allow setting an array to these properties, otherwise getting an infinite loop because values inside array won't be compared
    range: computed.struct,
    domain: computed.struct,
    zoomed: computed.struct,
    allowedTypes: computed.struct
}