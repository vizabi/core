import { observable } from "mobx";
import { isNonNullObject, isString } from "./utils";
import { stores } from "./vizabi";

/**
 * 
 * @param {*} possibleRef 
 * @returns config Config object as described in reference config
 */
 export function resolveRef(possibleRef, self) {
    // no ref
    if (!isReference(possibleRef))
        return possibleRef

    // handle config shorthand
    let ref = (isString(possibleRef.ref)) ? { model: possibleRef.ref } : possibleRef.ref;

    let firstNode = stores;
    if (ref.model.startsWith('.')) {
        firstNode = self;
        ref.model = ref.model.substring(1);
    }

    // invalid ref
    if (!ref.model) {
        console.warn("Invalid reference, expected string reference in ref or ref.model", possibleRef);
    }

    // model ref includes resolved defaults
    const model = resolveTreeRef(ref.model, firstNode);
    return transformModel(model, ref.transform);
}

export function isReference(possibleRef) {
    return isNonNullObject(possibleRef) && typeof possibleRef.ref != "undefined"
}

function resolveTreeRef(refStr, tree) {
    const ref = refStr.split('.');
    let node = tree;
    for (let i = 0; i < ref.length; i++) {

        let step = ref[i];
        if (step == '^') {
            node = node.parent; 
        } else if (typeof node.get == "function")
            node = node.get(step);
        else
            node = node[step];

        if (typeof node == "undefined") {
            console.warn("Couldn't resolve reference " + refStr);
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
                source: model.data.source,
                locale: model.data.locale
            });
        case "entityConceptSkipFilter":
            return observable({
                space: model.data.isConstant ? [] : [model.data.concept],
                source: model.data.source,
                locale: model.data.locale
            });
        default:
            return model;
            break;
    }
}