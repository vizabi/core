
export function interpolate(df) {
    return interpolateAllFields(df);
}

function interpolateAllFields(df) {
    const fields = Object.keys(df.values().next().value);
    for (let field of fields) {
        interpolateField(df, field);
    }
    return df;
}

function interpolateField(df, field) {
    let prevVal = null;
    let gapRows = [];
    for (let row of df.values()) {
        if (row[field] === null) {
            gapRows.push(row);
        } else {
            // fill gap if it exists and is inner
            if (prevVal != null && gapRows.length > 0) {
                interpolateGap(gapRows, prevVal, row[field], field);
            }
            gapRows = [];
            prevVal = row[field];
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