import { resolveRef } from "../vizabi";
import { dataSourceStore } from "../dataSource/dataSourceStore";
import { trace, observable } from "mobx";
import { applyDefaults, intersect, isNumeric } from "../utils";
import { filter } from "../filter";
import { DataFrame } from "../../dataframe/dataFrame";
import { applyFilterRow } from "../../dataframe/transforms/filter";

const defaultConfig = {
    source: null,
    concept: null,
    space: null,
    value: null,
    filter: null
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
            trace();
            if (this.config.source)
                return dataSourceStore.getByDefinition(this.config.source)
            else
                return (this.parent.marker) ? this.parent.marker.data.source : null;
        },
        get space() {
            //trace();
            if(this.config.space && !this.parent.marker && this.config.space.autoconfig) return this.solveAutoconfig.space;
            return this.config.space || ((this.parent.marker) ? this.parent.marker.data.space : null)
        },


        get solveAutoconfig() {
            const solutions = new Map();
      
            const availability = this.source.availability;
            const concepts = this.source.concepts;
            const markerConfig = this.parent.config;
            const availableSpaces = [...availability.keyLookup.values()].filter(f => !f.includes("concept"));
            const availableConcepts = [...concepts.values()];
            const conceptsInAllSpaces = [...new Set(availableSpaces.flat())]
              //get concepts resolved from IDs
              .map(c => concepts.get({concept: c}));
      
            //find concepts that are allowed by marker space autoconfig params
            const markerSpaceAutocfg = markerConfig.data.space.autoconfig;
            const allowedConcepts = conceptsInAllSpaces.filter(c => applyFilterRow(c, markerSpaceAutocfg)).map(c => c.concept);
      
            availableSpaces
              //only keep spaces that have all their keys among the allowed concepts
              .filter(s => s.every(c => allowedConcepts.includes(c)))
              //check if the space fits encoding autoconfig. for example: encodings want 2 measures for X and Y and time for FRAME
              //also find solutions to encoding autoconfigs along the way
              .forEach(space => {
      
                const encodings = Object.keys(markerConfig.encoding);
                const autoCfgEncs = encodings.filter(enc => typeof markerConfig.encoding[enc].data.concept.autoconfig !== "undefined");
      
                const solution = {}
                for (let enc of autoCfgEncs) {
                  let encSolution = this.parent.encoding.get(enc).data.solveEncAutoconfig(solution, space);
                  if (!encSolution) break;
                  solution[enc] = encSolution;
                }
      
                if(Object.keys(solution).length === autoCfgEncs.length) solutions.set(space, solution);
              })
      

            const [solutionWithShortestSpace, solutionForEncodings] = [...solutions].reduce((a,b) => a[0].length <= b[0].length ? a : b);
            return {space: solutionWithShortestSpace, encodings: solutionForEncodings};
        },

        solveEncAutoconfig(solution = {}, space){
            const availability = this.source.availability;
            const concepts = this.source.concepts;
            space = this.config.space || space;
            
            const encAutocfg = this.config.concept.autoconfig;
            const spaceKeyString = Vizabi.utils.createKeyStr(space);
      
            //encoding solution is done if there is no autoconfig pending
            if (!encAutocfg) return true;
      
            const conceptsInThisSpace = [...availability.keyValueLookup.get(spaceKeyString).keys()]
                //exclude the ones such as "is--country", they won't get resolved
                .filter(f => f.substr(0,4) !== "is--")
                //the concepts holding the space can participate in autoconfig of encodings too
                .concat(space)
                //get concepts resolved from IDs
                .map(c => concepts.get({concept: c}));      
      
            //find the first concept satisfying encoding's autoconfig criteria and not used for another encoding already
            return conceptsInThisSpace.find(c => applyFilterRow(c, encAutocfg) && !d3.values(solution).map(c => c.concept).includes(c.concept));
        },
        get constant() {
            return resolveRef(this.config.constant);
        },
        isConstant() {
            return this.constant != null;
        },
        get commonSpace() {
            return intersect(this.space, this.parent.marker.data.space);
        },
        get filter() {
            const config = this.config.filter || ((this.parent.marker) ? this.parent.marker.data.config.filter : {})
            return observable(filter(config, this));
        },
        get concept() { 
            if(this.config.concept && this.config.concept.autoconfig) 
                return this.parent.marker.data.solveAutoconfig.encodings[this.parent.prop].concept;
            return this.config.concept ? resolveRef(this.config.concept) : null 
        },
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
            if (this.constant != null)
                return isNumeric(this.constant) ? [this.constant,this.constant] : [this.constant];

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