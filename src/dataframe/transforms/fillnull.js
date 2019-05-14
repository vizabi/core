import { isNonNullObject } from "../utils";

export function fillNull(df, fillValues) {
    let concept, row;
    // per concept fill
    if (isNonNullObject(fillValues)) {
        for (concept in fillValues) {
            const fillValue = fillValues[concept];
            // per concept function fill
            if (typeof fillValue == "function") {
                for (row of df.values()) {
                    if (row[concept] === null)
                        row[concept] = fillValue(row);
                }
            }
            // per concept constant fill
            else {
                for (row of df.values()) {
                    if (row[concept] === null)
                        row[concept] = fillValue;
                }
            }
        }
    }
    // constant fill
    else {
        for (row of df.values()) {
            for (concept in row) {
                if (row[concept] === null)
                    row[concept] = fillValues;
            }
        }
    }
    return df;
}