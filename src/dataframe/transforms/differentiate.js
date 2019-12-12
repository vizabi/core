/*
  "Differentiate" a given field in this dataframe.
*/
export function differentiate(df, xField = 'x', yField = 'time') {
  let prevX, prevY;
  for (let row of df.values()) {
    const difference = prevX ? row[xField] - prevX : 0;
    prevX = row[xField];
    row[xField] = difference;
  }
  return df;
}