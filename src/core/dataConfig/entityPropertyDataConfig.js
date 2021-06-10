import { dataConfig } from './dataConfig';
import { composeObj, renameProperty } from '../utils';
import { trace, toJS, observable, action } from 'mobx';
import { fromPromise } from 'mobx-utils';
import { DataFrame } from '../../dataframe/dataFrame';
import { configSolver } from './configSolver';

export function entityPropertyDataConfig(config, parent) {
    return observable(
        entityPropertyDataConfig.nonObservable(observable(config), parent), {
        config: observable.ref
    });
}

entityPropertyDataConfig.nonObservable = function (cfg, parent) {

    if (!("concept" in cfg)) cfg.concept = { 
        solveMethod: 'mostCommonDimensionProperty', 
        allowedProperties: ['name', 'title']
    }

    const base = dataConfig.nonObservable(cfg, parent);

    return composeObj(base, {

        get space() {
            return base.space?.filter(dim => this.source.isEntityConcept(dim));
        },
        get queries() {
            const kvLookup = this.source.availability.keyValueLookup;
            return this.space
                .filter(dim => kvLookup.get(dim).has(this.concept))
                .map(dim => {
                    return this.createQuery({ space: [dim] });
                });
        },
        isConceptAvailableInSpace(space, concept) {
            return true; // could check if there's availability for some space dimensions
        },
        lookups(response, concept) {
            const lookups = new Map();
            response.forEach(dimResponse => {
                const { dim, data } = dimResponse;
                const lookup = new Map();
                lookups.set(dim, lookup);
                for (const row of data.raw) {
                    lookup.set(row[dim], row[concept]);
                }
            });
            return new Map([[concept, lookups]]);
        },
        get domain() {
            // could be an object with domain per dimension?
            return undefined;
        },
        fetchResponse() {
            const labelPromises = this.queries.map(query => this.source.query(query)
                .then(data => ({ dim: query.select.key[0], data }))
            );
            const promise = Promise.all(labelPromises).then(response => {
                const lookups = this.lookups(response, this.concept);
                return DataFrame.fromLookups(lookups, this.commonSpace)
            });
            this.responsePromise = fromPromise(promise);
        }
    })
}
entityPropertyDataConfig.decorate = dataConfig.decorate;