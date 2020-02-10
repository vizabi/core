import { DataFrame } from "../dataFrame";

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
    const int = d3.interpolate(startVal, endVal);
    const delta = 1 / (gapRows.length+1);
    let mu = 0;
    for (let gapRow of gapRows) {
        mu += delta;
        gapRow[field] = int(mu);
    }
}