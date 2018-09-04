import { resolveRef } from "../vizabi";
import { dataSourceStore } from "../dataSource/dataSourceStore";
import { trace, observable } from "mobx";
import { createMarkerKey, arrayEquals, deepmerge, applyDefaults } from "../utils";
import { filter } from "../filter";

const defaultConfig = {
    source: null,
    concept: null,
    filter: {}
}

export function dataConfig(config = {}, parent) {

    applyDefaults(config, defaultConfig);

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
        get response() {
            //trace();
            return this.promise.value;
        },
        get responseMap() {
            //trace();
            const responseMap = new Map();
            this.response.forEach(row => {
                const key = createMarkerKey(this.space, row);
                row[Symbol.for('key')] = key;
                responseMap.set(key, row);
            });
            return responseMap;
        },
        get conceptInSpace() {
            return this.concept && this.space && this.space.includes(this.concept);
        },
        get hasOwnData() {
            return this.source && this.concept && !this.conceptInSpace;
        },
        get ddfQuery() {
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