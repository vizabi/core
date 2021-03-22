import { observable } from "mobx";
import { isString } from "./utils";

/**
 * 
 * @param {*} possibleRef 
 * @returns config Config object as described in reference config
 */
 export function resolveRef(possibleRef) {
    // no ref
    if (!possibleRef || typeof possibleRef.ref === "undefined")
        return possibleRef

    // handle config shorthand
    let ref = (isString(possibleRef.ref)) ? { model: possibleRef.ref } : possibleRef.ref;

    // invalid ref
    if (!(ref.config || ref.model)) {
        console.warn("Invalid reference, expected string reference in ref, ref.model or ref.config", possibleRef);
    }

    if (ref.config) {
        // user set config only
        return resolveTreeRef(ref.config, config);
    } else {
        // model ref includes resolved defaults
        const model = resolveTreeRef(ref.model, stores);
        return transformModel(model, ref.transform);
    }
}

function resolveTreeRef(refStr, tree) {
    const ref = refStr.split('.');
    let node = tree;
    for (let i = 0; i < ref.length; i++) {
        let child = ref[i];
        if (typeof node == "undefined") {
            console.warn("Couldn't resolve reference " + refStr);
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
                source: model.data.source,
                locale: model.data.locale
            });
        case "entityConceptSkipFilter":
            return observable({
                space: model.data.isConstant() ? [] : [model.data.concept],
                source: model.data.source,
                locale: model.data.locale
            });
        default:
            // build new config based on model.config
            return model;
            break;
    }
}