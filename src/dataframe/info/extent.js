import { getIter } from "../dfutils";

// in the style of d3.extent
export function extent(iter, concept) {
    iter = getIter(iter);
    let min, max, value, row;
    for (row of iter) {
        if ((value = row[concept]) != null && value >= value) {
            if (min === undefined) {
                // find first comparable values
                min = max = value;
            } else {
                // compare remaining values 
                if (min > value) min = value;
                if (max < value) max = value;
            }
        }
    }
    return [min, max];
}
