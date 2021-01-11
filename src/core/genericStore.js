import { observable, action, toJS, isObservableObject } from 'mobx'
import { isString, isNonNullObject } from './utils'

const defaultType = config => observable({ config });
defaultType.nonObservable = config => ({ config })

export const createStore = function(baseType = defaultType, extendedTypes = {}) {
    return observable({
        modelTypes: {
            base: baseType,
            all: {
                baseType,
                ...extendedTypes
            }
        },
        named: new Map(),
        addType: function(modelType, modelConstructor) {
            if (this.modelTypes[modelType])
                console.warn("Adding model type " + modelType + " failed. Type already exists", this);
            this.modelTypes.all[modelType] = modelConstructor;
        },
        getAll: function() {
            return [ ...this.named.values() ];
        },
        create: action('create', function(config, parent, id) {
            if (config.config) config = config.config; // get config from model
            //if (isObservableObject(config)) config = toJS(config);
            let modelType = this.modelTypes.all[config.modelType] || this.modelTypes.base;
            let model = observable(
                modelType.nonObservable(config, parent, id), 
                { config: observable.ref }, 
                { name: modelType.name || config.modelType || 'base' }
            );
            if (model.setUpReactions) model.setUpReactions();
            if (id) this.set(id, model)
            return model;
        }),
        has(id) { return this.named.has(id) },
        set: action('set', function(id, model) { return this.named.set(id, model) }),
        get(idOrConfig, parent) {
            if (isString(idOrConfig))
                return this.named.get(idOrConfig) // id
            else
                return this.create(idOrConfig, parent) // config
        },
        createMany: function(configs) {
            const models = {};
            for (let id in configs) {
                models[id] = this.create(configs[id], null, id);
            }
            return models;
        }
    }, {
        named: observable.shallow
    });
}