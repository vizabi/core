import { dataConfig } from './dataConfig';
import { compose, renameProperty } from '../utils';
import { observable, trace } from 'mobx';
import { fromPromise } from 'mobx-utils';

export function labelDataConfig(cfg, parent) {
    const dataPlain = dataConfig(cfg, parent);

    return compose(dataPlain, {

        get promise() {
            const entityDims = this.space.filter(dim => this.source.isEntityConcept(dim));
            const labelPromises = entityDims.map(dim =>
                this.source.query({
                    select: {
                        key: [dim],
                        value: [this.concept]
                    },
                    from: "entities"
                }).then(data => ({
                    dim,
                    data
                }))
            );
            return fromPromise(Promise.all(labelPromises));
        },
        get lookups() {
            const lookups = new Map();
            this.response.forEach(response => {
                const { dim, data } = response;
                const lookup = new Map();
                lookups.set(dim, lookup);
                data.forEach(row => {
                    lookup.set(row[dim], row[this.concept]);
                })
            });
            return lookups;
        },
        addLabels(markers, encName) {
            markers.forEach((marker, key) => {
                const label = {};
                this.space.forEach(dim => {
                    if (this.lookups.has(dim))
                        label[dim] = this.lookups.get(dim).get(marker[dim]);
                    else
                        label[dim] = marker[dim];
                });
                marker[encName] = label;
            });
        }
    })
}