import { dataConfig } from './dataConfig';
import { composeObj, createModel } from '../utils';
import { trace, toJS, observable, action } from 'mobx';
import { fromPromise } from 'mobx-utils';
import { DataFrame } from '../../dataframe/dataFrame';

export function entityMembershipDataConfig(...args) {
    return createModel(entityMembershipDataConfig, ...args)
}

const defaults = {
    exceptions: {}
}

entityMembershipDataConfig.nonObservable = function (cfg, parent) {

    const base = dataConfig.nonObservable(cfg, parent);

    return composeObj(base, {

        get exceptions() {
            //Exceptions:
            //For example, we want regions to all go in one facet, but countries to take one facet each:
            //[China], [USA], [Asia, Africa, Europe]
            //This is achieved by a config like so:
            // "facet_row": {
            //     data: {
            //       modelType: "entityMembershipDataConfig",
            //       space: ["geo"],
            //       concept: "is--",
            //       exceptions: {"is--country": "geo"},
            //     }
            //   },
            return new Map(Object.entries(this.config.exceptions || defaults.exceptions));
        },

        fetchResponse() {
            let promise;
            if (this.concept === "is--")
                promise = this.spaceCatalog.then(spaceCatalog => {
                    const dim = this.space[0];

                    if(this.space.length > 1) 
                      console.warn(`DataConfig model of type entityMembershipDataConfig only supports one dimension,
                      but got configured to a multidimensional space:`, this.space.slice());

                    const isnessArray = [];

                    for (const [entityKey, entity] of spaceCatalog[dim].entities.entries()) {
                        let isness = Object.entries(entity)
                            .filter(([k,v]) => k.includes("is--") && v)
                            //support special cases
                            .map(([k,v]) => this.exceptions.has(k) ? entity[this.exceptions.get(k)] : k);
                            
                        //handle situation when entity is not included in any set
                        if (isness.length === 0) isness = ["is--" + dim];

                        isnessArray.push({[dim]: entity[dim], "is--": isness});
                    }
                    return DataFrame(isnessArray, [dim]);
                })
            else
                promise = this.source.query(this.ddfQuery)
                    .then(response => response.forKey(this.commonSpace))
            return fromPromise(promise);
        }
    })
}
entityMembershipDataConfig.decorate = dataConfig.decorate;