import { resolveRef } from "../vizabi";
import { dataSourceStore } from "../dataSource/dataSourceStore";
import { trace, observable } from "mobx";
import { applyDefaults, intersect } from "../utils";
import { filter } from "../filter";
import { DataFrame } from "../../dataframe/dataFrame";

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
            if (this.config.value == null) {
                console.warn("dataConfig.value is null. Probably you set an empty space but didn't set a constant value.", this);
            }
            return this.config.value;
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
            return this.source.query(this.ddfQuery);
        },
        get state() {
            return this.promise.state;
        },
        get domain() {
            const concept = this.concept;
            return (this.conceptProps.concept_type == "measure") ?
                d3.extent(this.response, d => d[concept]) :
                d3.set(this.response, d => d[concept]).values().sort();
        },
        get response() {
            trace();
            // constant response
            if (this.space.length == 0) {
                return [{ value: this.value }]
            }
            // data response
            return this.promise.case({
                pending: () => latestResponse,
                rejected: e => latestResponse,
                fulfilled: v => latestResponse = this.processResponse(v)
            });
        },
        processResponse(response) {
            return response;
        },
        get responseMap() {
            trace();
            return DataFrame(this.response, this.commonSpace);
        },
        get conceptInSpace() {
            return this.concept && this.space && this.space.includes(this.concept);
        },
        get hasOwnData() {
            return this.source && this.concept && !this.conceptInSpace;
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