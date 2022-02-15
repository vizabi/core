import { assign, pickGetters, relativeComplement } from "../../core/utils";

/**
 * Interpolate within a dataframe. Fill missing values in rows. Inplace.
 * @param {*} df 
 */
export function interpolate(df, fields = df.fields, interpolates = {}) {
    for (let field of fields) {
        interpolateField(df, field, interpolates[field]);
    }
    return df;
}

function interpolateField(df, field, interpolate) {
    const gap = newGap();
    for (let row of df.values()) {
        evaluateGap(row, field, gap, interpolate);
    }
}

export function newGap() {
    return {
        start: undefined,
        rows: []
    }
}

export function evaluateGap(row, field, gap, interpolate) {
    const { rows, start } = gap;
    const fieldVal = row[field];
    if (fieldVal == null) { // faster for undefined/null check
        if (start !== undefined)
            rows.push(row);
    } else {
        // fill gap if it exists and is inner
        if (rows.length > 0) {
            interpolateGap(rows, start, row, field, interpolate);
            rows.length = 0;
        }
        gap.start = row;
    }
}

function interpolateGap(gapRows, startRow, endRow, field, interpolate) {
    const startVal = startRow[field];
    const endVal = endRow[field];
    const int = (interpolate ? interpolate : d3.interpolate)(startVal, endVal);
    const delta = 1 / (gapRows.length+1);
    let mu = 0;
    for (let gapRow of gapRows) {
        mu += delta;
        gapRow[field] = int(mu);
        if (!(Symbol.for('interpolated') in gapRow))
            gapRow[Symbol.for('interpolated')] = {}
        gapRow[Symbol.for('interpolated')] = { [field]: [startRow, endRow] }
    }
}


export function interpolateGroup(group, { fields = group.fields, interpolates = {}, ammendNewRow = () => {} } = {}) {
    
    // what fields to interpolate?
    const groupFields = group.values().next().value.fields;
    const copyFields = relativeComplement(fields, groupFields);
    copyFields.push(Symbol.for('key'));

    //console.time('interpolate');
    const frameKeys = [...group.keys()]
    const numFrames = frameKeys.length;
    for (const field of fields) {
        const lastIndexPerMarker = new Map();
        for (let i = 0; i < numFrames; i ++) {
            const frame = group.get(frameKeys[i]);                  
            for (const markerKey of frame.keys()) {
                const marker = frame.getByStr(markerKey);
                if (marker[field] != null) {
                    const lastIndex = lastIndexPerMarker.get(markerKey);
                    if (lastIndex !== undefined && (i - lastIndex) > 1) {
                        const gapRows = []; // d3.range(lastIndex + 1, i).map(i => group.get(frameKeys[i]))
                        for (let j = lastIndex + 1; j < i; j++) {
                            const gapFrame = group.get(frameKeys[j]);
                            let gapRow = gapFrame.get(markerKey);
                            if (gapRow === undefined) {
                                gapRow = Object.assign(pickGetters(marker, copyFields), group.keyObject(gapFrame));
                                ammendNewRow(gapRow);
                                gapRow[Symbol.for('interpolated')] = {};
                                gapFrame.setByStr(markerKey, gapRow);
                            } else {
                                if (!(Symbol.for('interpolated') in gapRow)) {
                                    gapRow = assign({}, gapRow)
                                    gapRow[Symbol.for('interpolated')] = {};
                                    gapFrame.setByStr(markerKey, gapRow);
                                }
                            }
                            gapRows.push(gapRow);
                        }
                        const startRow = group.get(frameKeys[lastIndex]).get(markerKey);
                        const endRow = group.get(frameKeys[i]).get(markerKey);
                        interpolateGap(gapRows, startRow, endRow, field, interpolates[field]);
                    }
                    lastIndexPerMarker.set(markerKey, i);
                }
            }
        }
        //console.log('finished interpolating field', field);
        //console.timeLog('interpolate');
    }
    //console.timeEnd('interpolate');
    return group;
}