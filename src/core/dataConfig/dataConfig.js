import { resolveRef } from "../config";
import { dataSourceStore } from "../dataSource/dataSourceStore";
import { trace, observable } from "mobx";
import { applyDefaults, arrayEquals, fromPromiseAll, intersect, isNonNullObject, isNumeric } from "../utils";
import { filter } from "../filter";
import { DataFrame } from "../../dataframe/dataFrame";
import { createFilterFn } from "../../dataframe/transforms/filter";
import { fromPromise, FULFILLED } from "mobx-utils";
import { extent } from "../../dataframe/info/extent";
import { unique } from "../../dataframe/info/unique";
import { createKeyStr, isDataFrame } from "../../dataframe/dfutils";

const defaultConfig = {
}

const defaults = {
    filter: null,
    constant: null,
    concept: { autoconfig: { concept_type: "measure" } },
    space: { autoconfig: true },
    value: null,
    locale: null,
    source: null,
    domain: [0, 1],
    domainDataSource: 'auto'
}

export function dataConfig(config = {}, parent) {
    return observable(
        dataConfig.nonObservable(observable(config), parent),
        { config: observable.ref }, 
    );
}

dataConfig.nonObservable = function(config, parent) {

    applyDefaults(config, defaultConfig);
    let latestResponse = [];

    return {
        config,
        parent,
        get hasEncodingMarker() {
            return this.parent && this.parent.marker;
        },
        get invariants() {
            let fails = [];
            if (this.constant && (this.concept || this.source)) fails.push("Can't have constant value and concept or source set.");
            if (this.conceptInSpace && this.source) fails.push("Can't have concept in space and have a source simultaneously");
            if (fails.length > 0)
                console.warn("One or more invariants not satisfied:",fails,this);
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
        get space() {
            return this.configSolution.space;
        },
        get constant() {
            return resolveRef(this.config.constant) || defaults.constant;
        },
        isConstant() {
            return this.constant != null;
        },
        get commonSpace() {
            if (this.hasEncodingMarker)
                return intersect(this.space, this.parent.marker.data.space);
            else if (!this.marker) // dataConfig used on its own
                return this.space;
            console.warn('Cannot get data.commonSpace of Marker.data. Only meaningful on Encoding.data.')
        },
        get filter() {
            const config = this.config.filter || (this.hasEncodingMarker ? this.parent.marker.data.config.filter : {});
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
        get conceptProps() { return this.concept && this.source.getConcept(this.concept) },
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
                : this.hasEncodingMarker && this.parent.marker.transformedDataMaps.has(source) ? this.parent.marker.transformedDataMaps.get(source).get()
                : source === 'markers' ? this.parent.marker.dataMap  
                : this.responseMap;

            return data;
        },
        get domain() {
            //trace();
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
            let result;
            // const [userSpace, defaultSpace] = splitConfig(this.config, 'space');
            let spaceCfg = resolveRef(this.config.space) || fallbackSpaceCfg || defaults.space;
            let conceptCfg = resolveRef(this.config.concept) || defaults.concept;

            if (this.needsSpaceAutoCfg) {
                result = this.findSpaceAndConcept(spaceCfg, conceptCfg, avoidConcepts);
            } else if (this.needsConceptAutoCfg) {
                const plainArraySpace = spaceCfg.slice(0);
                result = this.findConceptForSpace(plainArraySpace, conceptCfg, avoidConcepts);
            } else {
                result = {
                    space: spaceCfg,
                    concept: conceptCfg
                }
            }

            return result;
        },

        findMarkerConfigForSpace(space) {
            let encodings = {};

            let success = [...Object.entries(this.parent.encoding)].every(([name, enc]) => {
                 let usedConcepts = Object.values(encodings).map(r => r.concept);
                let encResult = enc.data.encodingSolution(space, usedConcepts);
                if (encResult) {
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
            
            console.warn("Could not autoconfig to a space which also satisfies further results.", { dataConfig: this, spaceCfg });

            return false;
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
        findConceptForSpace(space, conceptCfg, usedConcepts = []) {
            let concept;

            if (conceptCfg && conceptCfg.autoconfig) {
                const satisfiesAutoCfg = typeof conceptCfg.autoconfig == 'boolean' 
                    ? () => true
                    : createFilterFn(conceptCfg.autoconfig);
                const availability = this.source.availability;

                const filteredConcepts =  [...availability.keyValueLookup.get(createKeyStr(space)).keys()]
                    // should be able to show space concepts (e.g. time)
                    .concat(space)
                    // exclude the ones such as "is--country", they won't get resolved
                    .filter(concept => concept.substr(0,4) !== "is--")
                    // configurable filter
                    .filter(concept => satisfiesAutoCfg(this.source.getConcept(concept)));
                
                concept = this.selectAutoCfgConcept({ concepts: filteredConcepts, dataConfig: this, usedConcepts })
                    || filteredConcepts[0]
                    || undefined;                                
                
            } else if (this.isConceptAvailableForSpace(space, conceptCfg)) {
                concept = conceptCfg;
            } 

            if (!concept) {
                console.warn("Could not autoconfig concept for given space.", { dataconfig: this, space });
                return false;
            } 

            return { concept, space };
        },
        selectAutoCfgConcept({ concepts, usedConcepts }) {
            // first try unused concepts, otherwise, use already used concept
            return concepts.find(concept => !usedConcepts.includes(concept));
        },
        get hasOwnData() {
            return this.source && this.concept && !this.conceptInSpace;
        },
        get needsSpaceAutoCfg() {
            return (this.config.space && this.config.space.autoconfig) || (!this.hasEncodingMarker && defaults.space.autoconfig && !this.config.space);
        },
        get needsConceptAutoCfg() {
            return this.config.concept && this.config.concept.autoconfig 
                || ((this.hasEncodingMarker || !this.marker) && !this.config.concept && defaults.concept && defaults.concept.autoconfig);
        },
        get needsAutoConfig() {
            return this.needsSpaceAutoCfg || this.needsConceptAutoCfg
        },
        get needsSource() {
            return this.needsAutoConfig;
        },
        get needsMarkerSource() {
            // const [userSpace, defaultSpace] = splitConfig(this.config, 'space');
            return !this.config.space && this.marker && this.marker.data.needsSource 
                || (!this.config.source && this.needsSource);
        },
        resolveOrSend() {

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
            const combined = fromPromiseAll(sourcePromises);
            return combined.case({ 
                fulfilled: () => this.hasOwnData ? this.sendQuery() : fromPromise.resolve(),
                pending: () => combined,
            })
        },
        get state() {
            return this.promise.state;
        },
        get response() {
            //trace();
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
            //trace();
            //response.key is not equal to space when we read csv file and response.key is empty
            if (isDataFrame(this.response) && arrayEquals(this.response.key, this.space))
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
                query.where = this.filter.whereClause(query.select.key);
            }
          
            if (this.locale) {
                query.language = this.locale; 
            }
          
            return query;
        },
    };
}
