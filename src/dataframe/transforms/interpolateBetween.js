import { DataFrame } from "../dataFrame";
import {interpolate as d3_interpolate} from "d3";
/**
 * Interplate between two DataFrames
 * @param {*} from 
 * @param {*} to 
 * @param {*} mu 
 */
export function interpolateBetween(from, to, mu, fields = from.fields, interpolators = {}) {
    const df = DataFrame([], from.key);

    let newRow, row2;
    for(const key of from.keys()) {
        const row1 = from.getByStr(key)
        row2 = to.getByStr(key);
        if (!row2) continue;
        if (row2 !== row1) { // same object, depends on trails using same object for trail markers across frames.
            newRow = Object.assign({}, row1);
            for (let field of fields) {
                newRow[field] = (interpolators[field] || d3_interpolate)(row1[field], row2[field])(mu);
            }
        } else {
            newRow = row1;
        }   
        df.set(newRow, newRow[Symbol.for('key')]);
    }
    return df;
}