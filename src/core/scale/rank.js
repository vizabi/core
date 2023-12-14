import { applyDefaults, assign, createModel, isNumeric, parseConfigValue, sortDateSafe } from "../utils";
import { scale, scales as _scales } from "./scale";

const defaultConfig = {
}

const scales = Object.assign({ rank: _scales["linear"]}, _scales);

export function rank(...args) {
  return createModel(rank, ...args)
}

rank.nonObservable = function (config, parent) {

    applyDefaults(config, defaultConfig);

    const s = scale.nonObservable(config, parent);

    Object.defineProperty(s, '__d3ScaleCreate', Object.getOwnPropertyDescriptor(s,'d3ScaleCreate'));

    return assign(s, {
        get isScaleTypeEqualsRank() {
            return (this.allowedTypes || ["rank"]).includes("rank") && this.scaleTypeNoGenLog([]) == "rank";
        },
        get d3Type() {
            return scales[this.type];
        },
        d3ScaleCreate() {
            if (this.type == 'rank') {
                const scale = scales[this.type]();
                if(scale.clamp) scale.clamp(this.clamp);
                return scale.domain(this.domain).range(this.range);
            } else {
                return this.__d3ScaleCreate();
            }
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
            } else if (this.isScaleTypeEqualsRank) {
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
        scaleTypeNoGenLog(domain = this.domain) {
            const concept = this.data.conceptProps;
            let scaleType = null;
            let scale;
            if (scales[this.config.type]) {
                scaleType = this.config.type;
            } else if (concept && concept.scales && (scale = JSON.parse(concept.scales).filter(s => !this.allowedTypes || this.allowedTypes.includes(s))[0]) && scales[scale]) {
                scaleType = scale;
            } else if (
                concept && ["entity_domain", "entity_set", "string", "boolean"].includes(concept.concept_type)
                || domain.length == 1
            ) {
                const range = this.calcRange(domain);
                if (!range.every(isNumeric) || range.length != 2)
                    scaleType = "ordinal"
                else
                    scaleType = domain.length == 1 ? "point" : "rank";
            } else if (concept && ["time"].includes(concept.concept_type)) {
                scaleType = "time";
            } else {
                scaleType = this.defaults.type;
            }
            return scaleType;
        },

    });
}