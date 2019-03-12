import { resolveRef } from "../vizabi";
import { dataSourceStore } from "../dataSource/dataSourceStore";
import { trace, observable } from "mobx";
import { applyDefaults, intersect, isNumeric } from "../utils";
import { filter } from "../filter";
import { DataFrame } from "../../dataframe/dataFrame";
import { fromPromise } from "mobx-utils";

const defaultConfig = {
    source: null,
    concept: null,
    space: null,
    value: null,
    filter: {}
}

export function dataConfig(config = {}, parent) {

    applyDefaults(config, defaultConfig);
    let latestResponse = [];

    return {
        config,
        parent,
        get invariants() {
            let fails = [];
            if (this.value && (this.concept || this.source)) fails.push("Can't have constant value and concept or source set.");
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
            return this.config.space || ((this.parent.marker) ? this.parent.marker.data.space : null)
        },
        get value() {
            return resolveRef(this.config.value);
        },
        get commonSpace() {
            return intersect(this.space, this.parent.marker.data.space);
        },
        get filter() {
            const config = this.config.filter || ((this.parent.marker) ? this.parent.marker.data.config.filter : {})
            return observable(filter(config, this));
        },
        get concept() { return this.config.concept ? resolveRef(this.config.concept) : null },
        get conceptProps() { return this.source.getConcept(this.concept) },
        get availability() { return this.source.availability.data.map(kv => this.source.getConcept(kv.value)) },
        get promise() {
            //trace();
            if (this.source && this.concept && !this.conceptInSpace)
                return this.source.query(this.ddfQuery);
            else
                return Promise.resolve(); // fromPromise.resolve();
        },
        get state() {
            return this.promise.state;
        },
        get domain() {
            if (this.value != null)
                return isNumeric(this.value) ? [this.value,this.value] : [this.value];

            const concept = this.concept;
            const data = this.conceptInSpace
                ? this.parent.marker.dataMapCache 
                : this.responseMap;

            if (["measure","time"].includes(this.conceptProps.concept_type)) 
                return data.extent(concept);
            
            const unique = new Set()
            for (let row of data.values()) unique.add(row[concept]); 
            return [...unique.values()].sort();
        },
        get response() {
            trace();
            return this.promise.case({
                pending: () => latestResponse,
                rejected: e => latestResponse,
                fulfilled: v => latestResponse = v
            });
        },
        get responseMap() {
            trace();
            return DataFrame(this.response, this.commonSpace);
        },
        get conceptInSpace() {
            return this.concept && this.space && this.space.includes(this.concept);
        },
        get ddfQuery() {
            trace();
            const query = {};
            // select
            query.select = {
                key: this.space.slice(), // slice to make sure it's a normal array (not mobx)
                value: [this.concept]
            }

            // from
            query.from = (this.space.length == 1) ? "entities" : "datapoints";

            // where
            if (this.filter) {
                query.where = this.filter.whereClause;
            }
            return query;
        },
    };
}