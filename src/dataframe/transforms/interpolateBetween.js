import { DataFrame } from "../dataFrame";
/**
 * Interplate between two DataFrames
 * @param {*} from 
 * @param {*} to 
 * @param {*} mu 
 */
export function interpolateBetween(from, to, mu) {
    const df = DataFrame([], from.key);
    
    let newRow, row2;
    for(const [key, row1] of from) {
        row2 = to.getByObjOrStr(undefined, key);
        if (!row2) continue;
        if (row2 !== row1) { // same object, depends on trails using same object for trail markers across frames.
            newRow = Object.assign({}, row1);
            for (let field in newRow) {
                newRow[field] = d3.interpolate(row1[field], row2[field])(mu);
            }
        } else {
            newRow = row1;
        }   
        df.set(newRow, newRow[Symbol.for('key')]);
    }
    return df;
}