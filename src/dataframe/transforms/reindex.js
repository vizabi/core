import { DataFrame } from "../dataFrame";

// TODO: add check if there are rows that are don't fit stepfn 
// (iterate over df and match one step of stepfn with step of iteration)
export function reindex(df, stepGen) {
    const empty = createEmptyRow(df.fields);
    const result = DataFrame([], df.key);
    const index = df.key[0]; // supports only single indexed
    for (let key of stepGen()) {
        const keyObj = { [index]: key };
        const row = df.has(keyObj) 
            ? df.get(keyObj)
            : Object.assign({ }, empty, keyObj);
        result.set(row);
    }
    return result;
}

function createEmptyRow(fields) {
    const obj = {};
    for (let field of fields) obj[field] = null;
    return obj;
}