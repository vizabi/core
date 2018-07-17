import { observable, action } from 'mobx'
import { assign } from './utils'

export default function(blueprints) {

    const modelStorage = observable({
        models: new Map(),
        get: function(id) {
            return this.models.get(id);
        },
        getAll: function() {
            return this.models;
        },
        has: function(id) {
            return this.models.has(id);
        },
        set: action(function(id, config) {
            this.models.set(id, modelFactory(config));
        }),
        setMany: action(function(configs) {
            for (let id in configs) {
                this.set(id, configs[id]);
            }
        })
    });

    const modelFactory = function(config) {

        const modelBlueprints = {
            base: config => {},
            ...blueprints
        }

        // default encoding object
        let model = modelBlueprints.base();

        // extend with type defaults
        if (config.type && modelBlueprints[config.type])
            assign(model, modelBlueprints[config.type]());

        // apply external config
        assign(model, modelBlueprints.config(config))

        // return observable version
        return observable(model);
    }

    return modelStorage;
}