
/**
 * Virtual data frame storage based on lookups. A row is constructed on request from lookups for each dimension of requested key.
 * @param {*} concepts Map of concepts. Each concept is a map of dimensions. Each dimension is a map of values on that dimension. E.g. name=>geo=>swe=>Sweden
 */
export function DataFrameStorageLookups(concepts, keyArr) {
    const storage = {};
    storage.fields = [...keyArr, ...concepts.keys()];
    storage.data = concepts;
    storage.has = (keyObj) => {
        // true if there is at least one concept which has a lookup for every dimension in key
        // i.e. a row can be returned for this key
        return true; //[...concepts.values()].some(lookups => keyArr.every(dim => dim in keyObj && lookups.has(dim)));
    }
    storage.get = (keyObj) => {
        const row = {};
        concepts.forEach((lookups, concept) => {
            const entityProps = {};
            keyArr.forEach(dim => {
                if (lookups.has(dim))
                    entityProps[dim] = lookups.get(dim).get(keyObj[dim]);
                else
                    entityProps[dim] = keyObj[dim];
            });
            row[concept] = entityProps;
        });
        return row;
    }
    storage.hasByObjOrStr = (keyObj, keyStr) => storage.has(keyObj);
    storage.getByObjOrStr = (keyObj, keyStr) => storage.get(keyObj);
    storage.set = (keyObj, value) => { 
        console.warn("Invalid operation. Generated dataframe does not support .set().")
    }
    storage.values = () => { console.warn("Generated dataframe .values() not implemented yet")};
    storage.delete = () => { console.warn("Invalid operation. Generated dataframe does not support .delete()")};
    storage[Symbol.iterator] = function* generate() {
        console.warn("Invalid operation. Generated dataframe iterator not yet implemented.");
    } 
    return storage;
}