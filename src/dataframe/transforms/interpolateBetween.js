import { DataFrame } from "../dataFrame";
/**
 * Interplate between two DataFrames
 * @param {*} from 
 * @param {*} to 
 * @param {*} mu 
 */
export function interpolateBetween(from, to, mu, fields = from.fields, interpolates = {}) {
    const df = DataFrame([], from.key);

    let newRow, row2;
    for(const key of from.keys()) {
        const row1 = from.getByStr(key)
        row2 = to.getByStr(key);
        if (!row2) continue;
        if (row2 !== row1) { // same object, depends on trails using same object for trail markers across frames.
            newRow = Object.assign({}, row1);
            for (let field of fields) {
                newRow[field] = (interpolates[field] ? interpolates[field] : d3.interpolate)(row1[field], row2[field])(mu);
            }
        } else {
            newRow = row1;
        }   
        df.set(newRow, newRow[Symbol.for('key')]);
    }
    return df;
}