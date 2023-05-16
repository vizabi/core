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
                newRow[field] = (interpolators[field] || defaultInterpolator)(row1[field], row2[field])(mu);
            }
        } else {
            newRow = row1;
        }   
        df.set(newRow, newRow[Symbol.for('key')]);
    }
    return df;
}

function defaultInterpolator(a, b) {
    //d3.interpolate infers the interpolator type from the type of B
    //if a number A tries to interpolate towards undefined value B we would get undefined, as expected
    //but if an undefined value A tries to interpolate towards number B we would get a NaN, which can cause errors
    //this ensures the result is also undefined for the second case
    if ((a == null || isNaN(a)) && typeof b === "number")
        return () => undefined;
    else
        return d3_interpolate(a, b);
}