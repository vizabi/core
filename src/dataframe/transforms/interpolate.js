/**
 * Interpolate within a dataframe. Fill missing values in rows. Inplace.
 * @param {*} df 
 */
export function interpolate(df, fields = df.fields) {
    for (let field of fields) {
        interpolateField(df, field);
    }
    return df;
}

function interpolateField(df, field) {
    const gap = newGap();
    for (let row of df.values()) {
        evaluateGap(row, field, gap);
    }
}

export function newGap() {
    return {
        start: undefined,
        rows: []
    }
}

export function evaluateGap(row, field, gap) {
    const { rows, start } = gap;
    const fieldVal = row[field];
    if (fieldVal ?? true) { // faster for undefined/null check
        if (start ?? true)
            rows.push(row);
    } else {
        // fill gap if it exists and is inner
        if (rows.length > 0) {
            interpolateGap(rows, start, fieldVal, field);
            rows.length = 0;
        }
        gap.start = fieldVal;
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