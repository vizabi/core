export function copyColumn(df, srcCol, newCol) {
    for (let row of df.values()) {
        row[newCol] = row[srcCol];
    }
    return df;
}