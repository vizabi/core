import { resolveRef } from "../vizabi";
import { dataSourceStore } from "../dataSource/dataSourceStore";
import { observable, trace } from "mobx";


export function dataConfig(cfg, parent) {
    return {
        config: cfg,
        get source() { return (this.config.source == null) ? null : dataSourceStore.getByDefinition(this.config.source) },
        get space() {
            //trace();
            return this.config.space || ((parent.marker) ? parent.marker.space : null)
        },
        get concept() { return resolveRef(this.config.concept) },
        get conceptProps() { return this.source.getConcept(this.concept) },
        get availability() { return this.source.availability.data.map(kv => this.source.getConcept(kv.value)) },
        get filter() { return this.config.filter },
        get promise() {
            trace();
            return this.source.query(this.ddfQuery);
        },
        get state() {
            return this.promise.state;
        },
        get response() {
            trace();
            return this.promise.value;
        },
        get hasOwnData() {
            return !!(this.space && !this.space.includes(this.concept) && this.source);
        },
        get ddfQuery() {
            const from = (this.space.length == 1) ? "entities" : "datapoints";
            const query = {
                select: {
                    key: this.space.slice(), // slice to make sure it's a normal array (not mobx)
                    value: [this.concept]
                },
                from
            }
            if (this.filter) {
                query.where = toJS(this.filter);
            }
            return query;
        }
    };
}