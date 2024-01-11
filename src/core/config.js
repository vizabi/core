import { observable } from "mobx";
import { isNonNullObject, isString } from "./utils";
import { stores } from "./vizabi";

/**
 * 
 * @param {*} possibleRef 
 * @returns config Config object as described in reference config
 */
 export function resolveRef(possibleRef, root = stores) {
    // not a ref
    if (!isReference(possibleRef))
        return { state: 'fulfilled', value: possibleRef }

    // handle config shorthand
    let ref = (isString(possibleRef.ref)) ? { path: possibleRef.ref } : possibleRef.ref;

    // invalid ref
    if (!ref.path) {
        console.warn("Invalid reference, expected string reference in ref or ref.path", possibleRef);
    }

    // model ref includes resolved defaults
    const result = resolveTreeRef(ref.path, root);
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
    //walk the tree
    for (let i = 0; i < ref.length; i++) {
        let nextStep = ref[i];
        prev = node;
        //use get function where there is one, i.e. stores, otherwise assume it's an object
        node = prev.get?.(nextStep) ?? prev[nextStep];

        if (typeof node == "undefined") {
            console.warn("Couldn't resolve reference " + refStr);
            return null;
        }
    }

    return { 
        //prev state is needed for example when we get a ref to a concept
        //concept doesn't have state, so we problby want to know the state of dataConfig instead

        //and since it's a getter we don't read it immediately
        //this prevents circular computations from happening if we do it right away
        //for example between order and the size encodings
        //referring to the state of size --> getting state of size -->
        //size checks marker config resolving state --> which wants to know order state
        //fortunately we don't need to read the state when constucting the reference
        //therefore we can have it in a computed
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
        case "orderDirection":
            const dim = model.parent.space[0];
            return observable(
                model.config.dimensions?.[dim]?.$or?.[0]?.[dim]?.$in || []
            ) 
        default:
            return model;
    }
}