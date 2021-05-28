import { resolveRef } from "../config";
import { dataSourceStore } from "../dataSource/dataSourceStore";
import { action, computed, observable, trace } from "mobx";
import { applyDefaults, combineStates, createSpaceFilterFn, getConceptsCatalog, intersect, isNumeric, lazyAsync } from "../utils";
import { fromPromise } from "mobx-utils";
import { extent } from "../../dataframe/info/extent";
import { unique } from "../../dataframe/info/unique";
import { createKeyStr } from "../../dataframe/dfutils";
import { configSolver } from "./configSolver";
import { filterStore } from "../filter/filterStore";

const defaultConfig = {
    allow: {},
    filter: {}
}

export function dataConfig(config = {}, parent, id) {
    return observable(
        dataConfig.nonObservable(observable(config), parent, id),
        { config: observable.ref }, 
    );
}

dataConfig.nonObservable = function(config, parent, id) {

    applyDefaults(config, defaultConfig);
    let latestResponse = [];

    return {
        defaults: {
            filter: null,
            constant: null,
            concept: { filter: { concept_type: "measure" } },
            space: { /* solve from data */ },
            value: null,
            locale: null,
            source: null,
            domain: [0, 1],
            domainDataSource: 'auto'
        },
        config,
        parent,
        id,
        type: 'dataConfig',
        get allow() {
            return observable({
                config: this.config.allow,
                parent: this,
                get space() {
                    return { 
                        filter: createSpaceFilterFn(this.config.space?.filter, this.parent)
                    }
                },
                get concept() {
                    return this.config.concept;
                },
                get source() {
                    return this.config.source;
                }
            })
        },
        get hasEncodingMarker() {
            return this.parent && this.parent.marker;
        },
        get marker() {
            if (this.hasEncodingMarker) {
                return this.parent.marker;
            }
            if (this.parent) {
                if (this.parent.marker) {
                    return this.parent.marker;
                }
                if (this.parent.encoding) {
                    return this.parent
                }
            }
            return undefined;
        },
        get source() {
            const source = resolveRef(this.config.source);
            if (source)
                return dataSourceStore.get(source, this)
            else {
                if (this.hasEncodingMarker)
                    return this.parent.marker.data.source;
                else
                    return null;
            }
        },
        get configSolution() {
            return configSolver.configSolution(this);
        },
        get space() {
            return this.configSolution.space;
        },
        get spaceCatalog() {
            return getConceptsCatalog(this.space, this, 1);
        },
        get commonSpace() {
            if (this.hasEncodingMarker)
                return intersect(this.space, this.parent.marker.data.space);
            else if (!this.marker) // dataConfig used on its own
                return this.space;
            console.warn('Cannot get data.commonSpace of Marker.data. Only meaningful on Encoding.data.')
        },
        get concept() {
            return resolveRef(this.configSolution.concept);
        },
        get conceptProps() { 
            return this.concept && this.source.getConcept(this.concept) 
        },
        get constant() {
            return resolveRef(this.config.constant) ?? this.defaults.constant;
        },
        get isConstant() {
            return this.constant != null;
        },
        get hasOwnData() {
            return !!(this.source && this.concept && !this.conceptInSpace);
        },
        get conceptInSpace() {
            return this.concept && this.space && this.space.includes(this.concept);
        },
        get filter() {
            const filter = resolveRef(this.config.filter);
            return filterStore.get(filter, this);
        },
        get locale() {
            if (this.config.locale)
                return typeof this.config.locale == "string" ? this.config.locale : this.config.locale.id;
            else
                return this.hasEncodingMarker ? this.parent.marker.data.locale || this.source?.locale : this.source?.locale;              
        },
        get availability() { return this.source.availability.data.map(kv => this.source.getConcept(kv.value)) },
        get domainDataSource() {
            let source = this.config.domainDataSource || this.defaults.domainDataSource;
            if (source === 'auto') {
                source = this.hasOwnData
                    ? 'self'
                    : this.conceptInSpace
                        ? 'filterRequired'
                        : undefined;
            }
            return source;
        },
        get domainData() {
            const source = this.domainDataSource;
            const data = source === 'self' ? this.response
                : this.hasEncodingMarker && this.parent.marker.transformedDataMaps.has(source) ? this.parent.marker.transformedDataMaps.get(source).get()
                : source === 'markers' ? this.parent.marker.dataMap  
                : this.response;

            return data;
        },
        get domain() {
            //trace();
            if (this.isConstant)
                return isNumeric(this.constant) ? [this.constant, this.constant] : [this.constant];

            return this.calcDomain(this.domainData, this.conceptProps);
        },
        calcDomain(data, { concept, concept_type } = this.conceptProps) { 
            // use rows api implemented by both group and df
            if (["measure","time"].includes(concept_type)) // continuous
                return extent(data.rows(), concept);
            else // ordinal (entity_set, entity_domain, string)
                return unique(data.rows(), concept); 
        },
        get beforeResponseState() {
            const states = [ this.marker.configSolvingState ];
            if (this.source) { states.push(this.source.conceptsState) } // conceptPromise needed for calcDomain()
            return combineStates(states);
        },
        get state() {
            const states = [ this.beforeResponseState, this.responseState ];
            const state = combineStates(states);
            if (state == 'fulfilled' && this.domainDataSource == 'self') this.domain; 
            return state;
        },
        createQuery({ space = this.space, concept = this.concept, filter = this.filter, locale = this.locale, source = this.source } = {}) {
            const query = {};
            
            const keyStr = createKeyStr(space);
            concept = Array.isArray(concept) ? concept : [concept];
            concept = concept.filter(concept => {
                return source.availability.keyValueLookup.get(keyStr).has(concept);
            })

            query.select = {
                key: space.slice(), // slice to make sure it's a normal array (not mobx)
                value: concept
            }
            query.from = (space.length === 1) ? "entities" : "datapoints";
            if (filter) {
                if (Array.isArray(filter)) {
                    query.where = Object.assign(...filter.map(f => f.whereClause(query.select.key))) 
                } else {
                    query.where = filter.whereClause(query.select.key);
                }
            }
            if (locale) {
                query.language = locale; 
            }
          
            return query;
        },
        get ddfQuery() {    
            return this.createQuery({ filter: [this.marker.data.filter, this.filter] })
        },
        response: [],
        responseState: 'fulfilled',
        fetchResponse() {
            if (this.beforeResponseState != 'fulfilled') {
                this.responseState = 'pending';
            } else if (this.hasOwnData) {
                this.responseState = 'pending';
                this.source.query(this.ddfQuery).then(action(response => {
                    this.response = response.forKey(this.commonSpace);
                    this.responseState = 'fulfilled';
                }))
            } else {
                this.responseState = 'fulfilled';
            }
        },
        disposers: [],
        onCreate() {
            const dispose = lazyAsync(this.fetchResponse.bind(this), this, "responseState");
            this.disposers.push(dispose);
        },
        dispose() { 
            for (const dispose of this.disposers) {
                dispose();
            }
        }
    };
}

dataConfig.decorate = {
    space: computed.struct,
    commonSpace: computed.struct,
    response: observable.ref
}
