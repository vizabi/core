import { getIter } from "../dfutils";

export function unique(iter, concept) {
    iter = getIter(iter);
    
    const unique = new Set()
    for (let row of iter) 
        unique.add(row[concept]); 

    return [...unique];
}
