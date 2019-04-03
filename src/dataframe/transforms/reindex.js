// TODO: add check if there are rows that are don't fit stepfn 
// (iterate over df and match one step of stepfn with step of iteration)
export function reindex(df, stepGen) {
    const empty = createEmptyRow(df.values().next().value);
    for (let key of stepGen()) {
        if (!df.hasByObjOrStr(null, key)) {
            const row = Object.assign({}, empty);
            df.setByKeyStr(key, row)
        }
    }
    return df;
}

function createEmptyRow(blueprint) {
    const obj = {};
    const fields = Object.keys(blueprint);
    for (let field of fields) obj[field] = null;
    return obj;
}