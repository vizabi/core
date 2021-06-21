import { observable, action } from 'mobx'
import { isModel, isString } from './utils'

const defaultType = config => observable({ config });
defaultType.nonObservable = config => ({ config })

export const createStore = function(baseType = defaultType, extendedTypes = {}) {
    return observable({
        modelTypes: {
            baseType,
            ...extendedTypes
        },
        models: {},
        addType: function(modelType, modelConstructor) {
            if (this.modelTypes[modelType])
                console.warn("Adding model type " + modelType + " failed. Type already exists", this);
            this.modelTypes[modelType] = modelConstructor;
        },    
        create: action('create', function(config, parent, id) {
            const modelType = this.modelTypes[config.modelType] || this.modelTypes.baseType;
            const model = modelType(...arguments);
            if (id) this.set(id, model);
            return model;
        }),
        createMany: action('createMany', function(configs) {
            const models = {};
            for (let id in configs) {
                models[id] = this.create(configs[id], null, id);
            }
            return models;
        }),
        has: function(id) {
            return id in this.models;
        },   
        get(reference, parent, name) {
            if (isString(reference)) {
                return this.models[reference] // id
            } else if (isModel(reference)) {
                return reference;
            } else {
                return this.create(reference, parent, name)
            }
        },
        getAll: function() {
            return Object.values(this.models);
        }, 
        set: action('set', function(id, model) { 
            return this.models[id] = model;
        }),
        dispose: action('dispose', function(id) {
            this.models[id].dispose();
            delete this.models[id];
        }),
        disposeAll: action('disposeAll', function() {
            // first dispose all then delete, so that any models build through references to these markers can be reached for disposal
            for (let id in this.models) {
                this.models[id].dispose();
            }
            for (let id in this.models) {
                delete this.models[id];
            }
        })
    }, {
        models: observable.shallow
    });
}