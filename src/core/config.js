import { observable } from "mobx";
import { isNonNullObject, isString } from "./utils";
import { stores } from "./vizabi";

/**
 * 
 * @param {*} possibleRef 
 * @returns config Config object as described in reference config
 */
 export function resolveRef(possibleRef) {
    // no ref
    if (!isReference(possibleRef))
        return { state: 'fulfilled', value: possibleRef }

    // handle config shorthand
    let ref = (isString(possibleRef.ref)) ? { path: possibleRef.ref } : possibleRef.ref;

    // invalid ref
    if (!ref.path) {
        console.warn("Invalid reference, expected string reference in ref or ref.path", possibleRef);
    }

    // model ref includes resolved defaults
    const result = resolveTreeRef(ref.path, stores);
    result.value = transformModel(result.value, ref.transform);
    return result;
}

export function isReference(possibleRef) {
    return isNonNullObject(possibleRef) && typeof possibleRef.ref != "undefined"
}

function resolveTreeRef(refStr, tree) {
    const ref = refStr.split('.');
    let prev;
    let node = tree;
    for (let i = 0; i < ref.length; i++) {
        let nextStep = ref[i];
        prev = node;
        node = prev.get?.(nextStep) ?? prev[nextStep];

        if (typeof node == "undefined") {
            console.warn("Couldn't resolve reference " + refStr);
            return null;
        }
    }

    return { 
        get state() { return node.state ?? prev.state ?? 'fulfilled' }, 
        value: node 
    }
}

function transformModel(model, transform) {
    switch (transform) {
        case "entityConcept":
            return observable({
                get space() { return model.data.isConstant ? [] : [model.data.concept] },
                get filter() {
                    return {
                        dimensions: {
                            [model.data.concept]: {
                                [model.data.concept]: { $in: model.scale.domain }
                            }
                        }
                    }
                },
                get source() { return model.data.source },
                get locale() { return model.data.locale }
            });
        case "entityConceptSkipFilter":
            return observable({
                get space() { return model.data.isConstant ? [] : [model.data.concept] },
                get source() { return model.data.source },
                get locale() { return model.data.locale }
            });
        default:
            return model;
    }
}