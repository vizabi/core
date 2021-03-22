import { interpolate as d3Interpolate } from 'd3-interpolate';

/**
 * Interpolate within a dataframe. Fill missing values in rows
 * @param {*} df 
 */
export function interpolate(df) {
    return interpolateAllFields(df);
}

function interpolateAllFields(df) {
    for (let field of df.fields) {
        interpolateField(df, field);
    }
    return df;
}

function interpolateField(df, field) {
    let prevVal = null;
    let gapRows = [];
    for (let row of df.values()) {
        const fieldVal = row[field];
        if (fieldVal === undefined || fieldVal === null) {
            gapRows.push(row);
        } else {
            // fill gap if it exists and is inner
            if (prevVal != null && gapRows.length > 0) {
                interpolateGap(gapRows, prevVal, fieldVal, field);
            }
            gapRows = [];
            prevVal = fieldVal;
        }
    }
}

function interpolateGap(gapRows, startVal, endVal, field) {
    const int = d3Interpolate(startVal, endVal);
    const delta = 1 / (gapRows.length+1);
    let mu = 0;
    for (let gapRow of gapRows) {
        mu += delta;
        gapRow[field] = int(mu);
    }
}