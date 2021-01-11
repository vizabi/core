import { dataSourceStore } from "../dataSource/dataSourceStore";
import { trace, observable, reaction } from "mobx";
import { fromPromiseAll, intersect, isNumeric } from "../utils";
import { filter } from "../filter";
import { DataFrame } from "../../dataframe/dataFrame";
import { createFilterFn } from "../../dataframe/transforms/filter";
import { fromPromise, FULFILLED } from "mobx-utils";
import { extent } from "../../dataframe/info/extent";
import { unique } from "../../dataframe/info/unique";
import { createKeyStr, isDataFrame } from "../../dataframe/utils";
import { applyDefaults, createConfig, splitConfig } from "../config/config";

export function dataConfig(config = {}, parent) {
    return observable(
        dataConfig.nonObservable(createConfig(config), parent),
        { config: observable.ref }, 
    );
}

dataConfig.nonObservable = function(config, parent) {

    debugger;
    applyDefaults(config, {
        concept: undefined,
        constant: undefined,
        filter: {},
        space: { autoconfig: { } },
        value: undefined,
        locale: undefined,
        source: undefined,
        domainDataSource: 'auto'
    })

    let latestResponse = [];

    return {
        config,
        parent,
        name: 'data',
        on: function(prop, fn) {
            if (this.validProp(prop) && typeof fn == "function") {
                const disposer = reaction(
                    () => this[prop], 
                    propVal => fn.call(this, propVal)
                );
                this.getEventListenersMapFor(prop).set(fn, disposer);
            }
            return this;
        },
        off: function(prop, fn) {
            if (this.validProp(prop) && this.eventListeners.get(prop).has(fn)){
                this.getEventListenersMapFor(prop).get(fn)(); // dispose
                this.getEventListenersMapFor(prop).delete(fn); // delete
            }
            return this;
        },
        validProp(prop) {
            return prop in this;
        },
        eventListeners: new Map(),
        getEventListenersMapFor(prop) {
            if (!this.eventListeners.has(prop))
                this.eventListeners.set(prop, new Map());
            return this.eventListeners.get(prop);
        },
        get path() {
            this.parent.path + '.' + this.name;
        },
        get invariants() {
            let fails = [];
            if (this.constant && (this.concept || this.source)) fails.push("Can't have constant value and concept or source set.");
            if (this.conceptInSpace && this.source) fails.push("Can't have concept in space and have a source simultaneously");
            if (fails.length > 0)
                console.warn("One or more invariants not satisfied:",fails,this);
        },
        get hasEncodingMarker() {
            return this.parent && this.parent.marker;
        },
        get source() {
            const source = this.config.source;
            if (source)
                return dataSourceStore.get(source, this)
            else
                return this.hasEncodingMarker ? this.parent.marker.data.source : null;
        },
        get space() {
            return this.configSolution.space;
        },
        get constant() {
            return this.config.constant;
        },
        isConstant() {
            return this.constant != null;
        },
        get commonSpace() {
            if (this.hasEncodingMarker)
                return intersect(this.space, this.parent.marker.data.space);
            else if (!this.marker)
                return this.space;
            console.warn('Cannot get data.commonSpace of Marker.data. Only meaningful on Encoding.data.')
        },
        get filter() {
            const config = this.config.filter || (this.hasEncodingMarker ? this.parent.marker.data.config.filter : undefined);
            return filter(config, this);
        },
        get locale() {
            if (this.config.locale)
                return typeof this.config.locale == "string" ? this.config.locale : this.config.locale.id;
            else
                return this.hasEncodingMarker ? this.parent.marker.data.locale : null;          
        },
        get concept() {
            return this.configSolution.concept;
        },
        get conceptProps() { return this.source.getConcept(this.concept) },
        get availability() { return this.source.availability.data.map(kv => this.source.getConcept(kv.value)) },
        get domainDataSource() {
            let source = this.config.domainDataSource;
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
                : this.hasEncodingMarker && this.parent.marker.transformedDataMaps.has(source) ? this.parent.marker.transformedDataMaps.get(source).get()
                : source === 'markers' ? this.parent.marker.dataMap  
                : this.responseMap;

            return data;
        },
        get domain() {
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

        /**
         * Finds a config which satisfies both marker.space and encoding.concept autoconfigs
         */
        get configSolution() {     
            if (this.marker) {
                if (this.hasEncodingMarker) {
                    return this.marker.data.markerSolution.encodings[this.parent.name];
                } else {
                    return this.marker.data.markerSolution;
                }
            } else {
                return this.encodingSolution();
            }
        },

        encodingSolution(fallbackSpaceCfg, avoidConcepts = []) {
            let space, concept;
            const [userSpace, defaultSpace] = splitConfig(this.config, 'space');
            let spaceCfg = userSpace || fallbackSpaceCfg || defaultSpace;
            let conceptCfg = this.config.concept;
    
            if (this.needsSpaceAutoCfg) {
                ({ space, concept } = this.findSpaceAndConcept(spaceCfg, conceptCfg, avoidConcepts));
            } else if (this.needsConceptAutoCfg) {
                const plainArraySpace = spaceCfg.slice(0);
                ({ space, concept } = this.findConceptForSpace(plainArraySpace, conceptCfg, avoidConcepts));
            } else {
                space = spaceCfg;
                concept = conceptCfg;
            }

            if (!space || !concept) {
                debugger;
                console.warn("Could not resolve space or encoding concepts for encoding.", this.encoding, { space, concept });
            }
            
            return { space, concept };
        },

        findMarkerConfigForSpace(space) {
            let encodings = {};

            let success = Object.entries(this.parent.encoding).every(([name, enc]) => {
                // only resolve concepts for encodings which use concept property
                if (!enc.data.config.concept) {
                    encodings[name] = { concept: undefined };
                    return true;
                }

                let encResult = enc.data.encodingSolution(space, Object.values(encodings).map(r => r.concept));
                if (encResult.concept && encResult.space) {
                    encodings[name] = encResult;
                    return true;
                }
                return false;
            });

            return success ? { encodings, space } : undefined;
        },

        get markerSolution() {
            if (!this.parent.encoding)
                console.warn(`Can't get marker solution for a non-marker dataconfig.`)

            if (this.config.space && this.config.space.autoconfig) {

                if (!this.source) {
                    console.warn(`Can't autoconfigure marker space without a source defined.`)
                    return;
                }

                return this.autoConfigSpace(this.config.space, this.findMarkerConfigForSpace.bind(this))

            } else {
                return this.findMarkerConfigForSpace(this.config.space);
            }
        },

        autoConfigSpace(spaceCfg, getFurtherResult) {

            const satisfiesSpaceAutoCfg = createFilterFn(spaceCfg.autoconfig);
            const spaces = [...this.source.availability.keyLookup.values()]
                .sort((a, b) => a.length - b.length); // smallest spaces first

            for (let space of spaces) {
                let result;
                if (!space.includes("concept") 
                    && space
                        .map(c => this.source.getConcept(c))
                        .every(satisfiesSpaceAutoCfg)
                    && (result = getFurtherResult(space))
                ) {
                    return result
                }
            }
        },

        findSpaceAndConcept(spaceCfg, conceptCfg, avoidConcepts) {

            return this.autoConfigSpace(spaceCfg, space => {
                return this.findConceptForSpace(space, conceptCfg, avoidConcepts)
            })
            
        },

        isConceptAvailableForSpace(space, concept) {
            const keyStr = createKeyStr(space);
            return this.source.availability.keyValueLookup.get(keyStr).has(concept);
        },

        /**
         * Tries to find encoding concept for a given space, encoding and partial solution which contains concepts to avoid.  
         * Should be called with encoding.data as `this`. 
         * Returns concept id which satisfies encoding definition (incl autoconfig) and does not overlap with partial solution.
         * @param {*} space 
         * @param {*} conceptCfg
         * @param {*} avoidConcepts array of concept ids to avoid in finding autoconfig solution
         * @returns {string} concept id
         */
        findConceptForSpace(space, conceptCfg, avoidConcepts = []) {
            if (conceptCfg && conceptCfg.autoconfig) {
                const satisfiesAutoCfg = createFilterFn(conceptCfg.autoconfig);
                const availability = this.source.availability;

                const concept =  [...availability.keyValueLookup.get(createKeyStr(space)).keys()]
                    // should be able to show space concepts (e.g. time)
                    .concat(space)
                    // first try preferred concepts, otherwise, use avoided concept
                    .filter(concept => !avoidConcepts.includes(concept)) 
                    // exclude the ones such as "is--country", they won't get resolved
                    .filter(concept => concept.substr(0,4) !== "is--")
                    .find(concept => satisfiesAutoCfg(this.source.getConcept(concept)))
                    || avoidConcepts[0]
                    || undefined;

                return { space, concept };
            } else if (this.isConceptAvailableForSpace(space, conceptCfg)) {
                return { space, concept: conceptCfg };
            }
            return undefined;
        },
        get hasOwnData() {
            return this.source && this.concept && !this.conceptInSpace;
        },
        get needsSpaceAutoCfg() {
            return this.config.space && this.config.space.autoconfig;
        },
        get needsConceptAutoCfg() {
            return this.config.concept && this.config.concept.autoconfig;
        },
        get needsAutoConfig() {
            return this.needsSpaceAutoCfg || this.needsConceptAutoCfg
        },
        get needsSource() {
            return this.needsAutoConfig;
        },
        get needsMarkerSource() {
            const [userSpace, defaultSpace] = splitConfig(this.config, 'space');
            return !userSpace && this.marker && this.marker.data.needsSource 
                || (!this.config.source && this.needsSource);
        },
        sendQuery() {
            if (!this.source || !this.concept) {
                console.warn("Encoding " + this.parent.name + " was asked for data but source and/or concept is not set.");
                return fromPromise.resolve();
            } else if (this.conceptInSpace) {         
                //console.warn("Encoding " + this.parent.name + " was asked for data but concept is in space.", { space: this.space, concept: this.concept }); 
                return fromPromise.resolve(); 
            } else {
                return this.source.query(this.ddfQuery);
            }
        },
        get promise() {
            const sourcePromises = [];
            if (this.isConstant()) { return fromPromise.resolve() }
            if (this.needsSource) { sourcePromises.push(this.source.metaDataPromise) }
            if (this.needsMarkerSource) { sourcePromises.push(this.marker.data.source.metaDataPromise); }
            if (sourcePromises.length > 0) {
                const combined = fromPromiseAll(sourcePromises);
                return combined.case({ 
                    fulfilled: () => this.sendQuery(),
                    pending: () => combined,
                })
            } else {
                return this.sendQuery();
            }
        },
        get state() {
            return this.promise.state;
        },
        get response() {
            if (this.isConstant()) {
                throw(new Error(`Can't get response for dataConfig with constant value.`))
            }
            return this.promise.case({
                pending: () => latestResponse,
                rejected: e => latestResponse,
                fulfilled: (res) => latestResponse = res
            });
        },
        get responseMap() {
            if (isDataFrame(this.response))
                return this.response;
            else
                return DataFrame(this.response, this.commonSpace);
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
          
            if (this.locale) {
                query.language = this.locale; 
            }
          
            return query;
        },
    }
}