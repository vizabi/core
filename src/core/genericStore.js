import { observable, action, toJS, isObservableObject } from 'mobx'
import { isString, isNonNullObject } from './utils'
import { resolveRef } from './vizabi';

export const createStore = function(baseType, extendedTypes = {}) {
    return observable({
        modelTypes: {
            base: baseType,
            all: {
                baseType,
                ...extendedTypes
            }
        },
        named: new Map(),
        configRef: new Map(),
        get: function(id) {
            return this.named.get(id);
        },
        addType: function(modelType, modelConstructor) {
            if (this.modelTypes[modelType])
                console.warn("Adding model type " + modelType + " failed. Type already exists", this);
            this.modelTypes.all[modelType] = modelConstructor;
        },
        getAll: function() {
            return [...this.named.values(), ...this.configRef.values()];
        },
        has: function(id) {
            return this.named.has(id);
        },
        create: function(config, parent) {
            //if (isObservableObject(config)) config = toJS(config);
            let modelType = this.modelTypes.all[config.modelType] || this.modelTypes.base;
            let model = observable(
                modelType(config, parent), 
                modelType.decorate || undefined, 
                { name: modelType.name || config.modelType || 'base' }
            );
            if (model.setUpReactions) model.setUpReactions();
            return model;
        },
        set: action('store set', function(config, id, parent) {
            let model = this.create(config, parent);
            id ? this.named.set(id, model) : this.configRef.set(config, model);
            return model;
        }),
        setMany: function(configs) {
            const models = {};
            for (let id in configs) {
                models[id] = this.set(configs[id], id);
            }
            return models;
        },
        /**
         * Definition is either the (1) model config object or (2) string id of the model  
         * Case 1: creates and returns anonymous model
         * Case 2: tries to fetch model from named models
         * @param {string/object} def 
         * @returns {model} Returns the model that was fetched or created
         */
        getByDefinition(def, parent) {

            // get by config by reference string
            // e.g. "markers.bubbles.encoding.size.data.concept"
            if (isString(def.ref) || isNonNullObject(def.ref)) {
                if (this.configRef.has(def)) {
                    return this.configRef.get(def);
                }
                def = resolveRef(def);
            }

            // get by config of another model
            if (isNonNullObject(def) && "config" in def) {
                def = def.config;
            }

            // get by config object
            if (!isString(def) && def !== null) {
                if (this.configRef.has(def)) {
                    return this.configRef.get(def);
                }
                return this.set(def, null, parent);
            }

            // get by string name/id
            if (this.has(def)) {
                return this.get(def);
            }
            console.warn("Store: cannot find model with definition: ", def, { store: this });
            return null;
        },
        /**
         * 
         * @param {*} defs Object of model definitions
         * @returns {Map} Map with models according to definitions
         */
        getByDefinitions(defs, parent) {
            const map = new Map();
            Object.keys(defs).forEach(prop => {
                map.set(prop, this.getByDefinition(defs[prop]), parent)
            })
            return map;
        }

    }, {
        named: observable.shallow,
        configRef: observable.shallow
    });
}