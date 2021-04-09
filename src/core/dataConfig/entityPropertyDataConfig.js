import { dataConfig } from './dataConfig';
import { composeObj, renameProperty } from '../utils';
import { trace, toJS, observable } from 'mobx';
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

        get needsSource() {
            return true;
        },
        sendQuery() {
            const labelPromises = this.queries.map(query => this.source.query(query)
                .then(data => ({ dim: query.select.key[0], data }))
            );
            return fromPromise(Promise.all(labelPromises));
        },
        get queries() {
            const entityDims = this.space.filter(dim => this.source.isEntityConcept(dim));
            const kvLookup = this.source.availability.keyValueLookup;
            return entityDims
                .filter(dim => kvLookup.get(dim).has(this.concept))
                .map(dim => {
                    const query = {
                        select: {
                            key: [dim],
                            value: [this.concept]
                        },
                        from: "entities"
                    }

                    if (this.filter) {
                        query.where = this.filter.whereClause(query.select.key);
                    }

                    if (this.locale) {
                        query.language = this.locale; 
                    }

                    return query;
                });
        },
        get lookups() {
            const concept = this.concept;
            const lookups = new Map();
            this.response.forEach(response => {
                const { dim, data } = response;
                const lookup = new Map();
                lookups.set(dim, lookup);
                data.forEach(row => {
                    lookup.set(row[dim], row[concept]);
                })
            });
            return new Map([[this.concept, lookups]]);
        },
        get responseMap() {
            return DataFrame.fromLookups(this.lookups, this.commonSpace)
        },
        addLabels(markers, encName) {
            // reduce lookups
            const space = toJS(this.space);
            const lookups = this.lookups;
            markers.forEach((marker, key) => {
                const label = {};
                space.forEach(dim => {
                    if (lookups.has(dim))
                        label[dim] = lookups.get(dim).get(marker[dim]);
                    else
                        label[dim] = marker[dim];
                });
                marker[encName] = label;
            });
        }
    })
}