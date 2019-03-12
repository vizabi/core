/**
 * Adds column to df, in place
 * @param {DataFrame} df 
 * @param {string} name 
 * @param {value|function} value 
 */
export function addColumn(df, name, value) {
    if (typeof value == "function") {
        for (let row of df.values()) {
            row[name] = value(row);
        }
    }
    else {    
        for (let row of df.values()) {
            row[name] = value;
        }
    }
    return df;
}