import { observable, isObservableObject } from "mobx";
import { layeredConfig } from "./layeredConfig";
import { isNonNullObject, isString, isMergeableObject, deepclone } from "../utils";

export function createConfig(configArray, externalRoots = {}) {
    if(!Array.isArray(configArray)) configArray = [configArray];
    configArray.push({}) // add default config
    const observableConfigs = configArray.map(cfg => observable(cfg));
    const layered = layeredConfig(observableConfigs);
    const referenceResolved = referencedConfig(layered, externalRoots);
    return referenceResolved;
}

export function getLayer(config, layer) {
    return config[Symbol.for('vizabi-config-layers')][layer];
}

export function getLayers(config) {
    return config[Symbol.for('vizabi-config-layers')];
}

export function splitConfig(config, prop) {
    let user, def;
    const layers = getLayers(config);
    for (let i = 0; i < (layers.length - 1); i++ ) {
        if (layers[i] && layers[i][prop]) {
            user = layers[i][prop];
            break;
        }
    }
    def = layers[layers.length - 1][prop];
    return [user, def];

}

export function getWithoutDefault(config, prop) {
}

export function getDefault(config, prop) {
    const layers = getLayers(config);
    return layers[layers.length - 1][prop];
}

export function applyDefaults(config, defaults) {
    const layers = getLayers(config);
    if (!layers) debugger;
    const layerIdx = layers.length - 1;
    const defaultProps = Object.keys(defaults);
    //if (!configLayer && defaultProps.length > 0) {
    //    configLayer = config[Symbol.for('vizabi-config-createLayer')](layers.length - 1);
    //}
    defaultProps.forEach(prop => {
        const configLayer = layers[layerIdx];
        if (!configLayer || !configLayer.hasOwnProperty(prop)){
            /*const defaultValue = isMergeableObject(defaults[prop])
                ? deepclone(defaults[prop])
                : defaults[prop];
            */
            config[Symbol.for('vizabi-config-setProxy')](prop, defaults[prop], layerIdx); // object
        } else if (isMergeableObject(defaults[prop])) {
            if (isMergeableObject(configLayer[prop]))
                applyDefaults(config[prop], defaults[prop]);
            //else
            //    configLayer[prop] = deepclone(defaults[prop]);
        }
    })
    return config;
}

function referencedConfig(cfg, externalRoots) {
    const roots = Object.assign({ self: cfg }, externalRoots);
    return resolveConfigTree(cfg, roots);
}

function resolveConfigTree(node, roots) {

    return new Proxy(node, {
        get(target, property) {
            let value = target[property];

            // symbols not needed & messes with mobx internals
            if (typeof property == 'symbol')
                return value;

            if (value && value.ref)
                value = resolveRef(value, roots);
            
            if (isNonNullObject(value) && !Array.isArray(value)) 
                return resolveConfigTree(value, roots)
            else
                return value;
        }
    });
}

/**
 * 
 * @param {*} possibleRef 
 * @returns config Config object as described in reference config
 */
export function resolveRef(possibleRef, roots) {

    if (!possibleRef || !possibleRef.ref)
        return possibleRef;

    // handle config shorthand
    let ref = isString(possibleRef.ref) ? { root: "self", path: possibleRef.ref } : possibleRef.ref;

    // resolve root string to root object
    let root = roots[ref.root];

    // invalid ref
    if (!root) {
        console.warn("Could not find defined root object when resolving reference. Pass the defined root to resolver.", { ref, roots });
    }

    const resolvedObj = findNodeByPath(ref.path, root);
    const tranformed = transformModel(resolvedObj, ref.transform);
    return resolveRef(tranformed, roots);
}

function findNodeByPath(path, root) {
    const refParts = path.split('.');
    let node = root;
    for (let child of refParts) {
        if (typeof node.get == "function")
            node = node.get(child);
        else
            node = node[child];
        if (typeof node == "undefined") {
            console.warn("Couldn't resolve path " + path + ". Failed to get " + child, { root });
            return null;
        }
    }
    return node;
}

function transformModel(model, transform) {
    switch (transform) {
        case "entityConcept":
            return observable({
                space: [model.data.concept],
                filter: {
                    dimensions: {
                        [model.data.concept]: {
                            [model.data.concept]: { $in: model.scale.domain }
                        }
                    }
                },
                source: "gap"
            });
        default:
            return model;
            // build new config based on model.config
            break;
    }
}