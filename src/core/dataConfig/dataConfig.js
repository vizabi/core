import { resolveRef } from "../vizabi";
import { dataSourceStore } from "../dataSource/dataSourceStore";
import { trace, observable } from "mobx";
import { applyDefaults, intersect, isNumeric } from "../utils";
import { filter } from "../filter";
import { DataFrame } from "../../dataframe/dataFrame";
import { fromPromise } from "mobx-utils";
import { extent } from "../../dataframe/info/extent";
import { unique } from "../../dataframe/info/unique";

const defaultConfig = {
}

const defaults = {
    filter: null,
    constant: null,
    concept: null,
    space: null,
    source: null,
    domain: [0, 1],
    domainDataSource: 'auto'
}

export function dataConfig(config = {}, parent) {

    applyDefaults(config, defaultConfig);
    let latestResponse = [];

    return {
        config,
        parent,
        get invariants() {
            let fails = [];
            if (this.constant && (this.concept || this.source)) fails.push("Can't have constant value and concept or source set.");
            if (this.conceptInSpace && this.source) fails.push("Can't have concept in space and have a source simultaneously");
            if (fails.length > 0)
                console.warn("One or more invariants not satisfied:",fails,this);
        },
        get source() {
            if (this.config.source)
                return dataSourceStore.getByDefinition(this.config.source)
            else
                return (this.parent.marker) ? this.parent.marker.data.source : null;
        },
        get space() {
            //trace();
            return this.config.space || (this.parent.marker ? this.parent.marker.data.space : defaults.space)
        },
        get constant() {
            return resolveRef(this.config.constant) || defaults.constant;
        },
        isConstant() {
            return this.constant != null;
        },
        get commonSpace() {
            return intersect(this.space, this.parent.marker.data.space);
        },
        get filter() {
            const config = this.config.filter || (this.parent.marker ? this.parent.marker.data.config.filter : {})
            return observable(filter(config, this));
        },
        get concept() { return this.config.concept ? resolveRef(this.config.concept) : defaults.concept },
        get conceptProps() { return this.source.getConcept(this.concept) },
        get availability() { return this.source.availability.data.map(kv => this.source.getConcept(kv.value)) },
        get domainDataSource() {
            let source = this.config.domainDataSource || defaults.domainDataSource;
            if (source === 'auto') {
                source = this.conceptInSpace
                    ? 'filterRequired'
                    : 'self';
            }
            return source;
        },
        get domainData() {
            const source = this.domainDataSource;
            const data = source === 'self' ? this.responseMap
                : this.parent.marker.transformedDataMaps.has(source) ? this.parent.marker.transformedDataMaps.get(source).get()
                : source === 'markers' ? this.parent.marker.dataMap  
                : this.responseMap;

            return data;
        },
        get domain() {
            trace();
            if (this.isConstant())
                return isNumeric(this.constant) ? [this.constant, this.constant] : [this.constant];

            return this.calcDomain(this.domainData, this.conceptProps);
        },
        calcDomain(data, { concept, concept_type }) { 
            // use rows api implemented by both group and df
            if (["measure","time"].includes(concept_type)) // continuous
                return extent(data.rows(), concept);
            else // ordinal (entity_set, entity_domain, string)
                return unique(data.rows(), concept); 
        },
        get promise() {
            //trace();
            return fromPromise(Promise.all([
                this.source.metaDataPromise,
                this.source.query(this.ddfQuery)
            ]));
        },
        get state() {
            if (this.source && this.concept && !this.conceptInSpace)
                return this.promise.state;
            else   
                return "fulfilled"
        },
        get response() {
            trace();
            if (!this.source || !this.concept || this.conceptInSpace) {
                if (this.conceptInSpace)
                    console.warn("Encoding " + this.parent.name + " was asked for data but it has no own data. Reason: Concept in space.");
                else
                    console.warn("Encoding " + this.parent.name + " was asked for data but it has no own data.");
            }
            return this.promise.case({
                pending: () => latestResponse,
                rejected: e => latestResponse,
                fulfilled: (res) => latestResponse = res
            });
        },
        get responseMap() {
            trace();
            return DataFrame(this.response[1], this.commonSpace);
        },
        get conceptInSpace() {
            return this.concept && this.space && this.space.includes(this.concept);
        },
        get ddfQuery() {
            const query = {};
            // select
            query.select = {
                key: this.space.slice(), // slice to make sure it's a normal array (not mobx)
                value: [this.concept]
            }

            // from
            query.from = (this.space.length === 1) ? "entities" : "datapoints";

            // where
            if (this.filter) {
                query.where = this.filter.whereClause;
            }
            return query;
        },
    };
}