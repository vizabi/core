import { observable, isObservableObject } from "mobx";
import { isString } from "./utils";

export function createConfig(configObject, externalRoots = {}) {
    const observableCfg = observable(configObject);
    Object.assign(externalRoots, { self: observableCfg });
    const dereffedCfg = resolveReferences(observableCfg, externalRoots);
    return dereffedCfg;
}

function resolveReferences(node, roots) {
    // resolve if this node is a reference node
    let resolved = resolveRef(node, roots);

    // return if leaf node
    if (typeof resolved !== "object" || !isObservableObject(resolved)) 
        return resolved;

    let clone = {};
    // recursively clone other properties in this node as computed props
    for (let key in node) {
        if (key === "ref") continue;
        copyPropertyAsComputed(node, key, clone);
    }
    if (node !== resolved) {
        for (let key in resolved) {
            copyPropertyAsComputed(resolved, key, clone);
        }
    }

    return clone;

    function copyPropertyAsComputed(obj, key, target) {
        Object.defineProperty(target, key, {
            enumerable: true,
            configurable: true,
            get: function() {
                return resolveReferences(obj[key], roots);
            },
            set: function(value) {
                obj[key] = value;
            }
        });
    }
}

/**
 * 
 * @param {*} possibleRef 
 * @returns config Config object as described in reference config
 */
export function resolveRef(possibleRef, roots) {
    // no ref
    if (!possibleRef || typeof possibleRef.ref === "undefined")
        return possibleRef

    // handle config shorthand
    let ref = isString(possibleRef.ref) ? { root: "self", path: possibleRef.ref } : possibleRef.ref;

    // resolve root to actual root object
    let root = roots[ref.root];

    // invalid ref
    if (!root) {
        console.warn("Invalid reference, root object neither found in reference nor passed to reference resolver.", { ref, root });
    }

    const resolvedObj = resolveTreeRef(ref, root);
    return transformModel(resolvedObj, ref.transform);
    if (ref.config) {
        // user set config only
        return resolveTreeRef(ref.config, root);
    } else {
        // model ref includes resolved defaults
        const model = resolveTreeRef(ref.model, stores);
        return transformModel(model, ref.transform);
    }
}

function resolveTreeRef({ path }, root) {
    const refParts = path.split('.');
    let node = root;
    for (let child of refParts) {
        if (typeof node == "undefined") {
            console.warn("Couldn't resolve reference path " + path, { root });
            return null;
        }
        if (typeof node.get == "function")
            node = node.get(child);
        else
            node = node[child];
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