import { observable, action } from 'mobx'
import { isModel, isString } from './utils'

const defaultType = config => observable({ config });
defaultType.nonObservable = config => ({ config })

export const createStore = function(baseType = defaultType, extendedTypes = {}) {
    return observable({
        // add types on store creation
        modelTypes: {
            baseType,
            ...extendedTypes
        },
        models: {},
        // add types later during runtime
        addType: function(modelType, modelConstructor) {
            if (this.modelTypes[modelType])
                console.warn("Adding model type " + modelType + " failed. Type already exists", this);
            this.modelTypes[modelType] = modelConstructor;
        },    
        create: action('create', function(config, parent, id) {
            //model can be of a special type, such as frame or color scale
            //otherwise it falls back to generic type: encoding or scale that would be
            const createModelOfType = this.modelTypes[config.modelType] || this.modelTypes.baseType;
            //see utils.createModel()
            const model = createModelOfType(...arguments);
            if (id) this.set(id, model);
            return model;
        }),
        //used for example when passing multiple markers in Vizabi()
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
        get(arg, parent, name) {
            //get or create actually
            if (isString(arg)) {
                //resolve arg as reference if it's a string - get it from the store
                return this.models[arg] // id
            } else if (isModel(arg)) {
                //no-op: if asking for a model - return it without change
                return arg;
            } else {
                //otherwise assume arg is a config for a new model to be created
                //allows creating multiple models from the same config
                //e.g. order.data and size.data are created from the same config
                //see marker get encoding(), marker.encodingCache() and encodingCache.js
                return this.create(arg, parent, name)
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