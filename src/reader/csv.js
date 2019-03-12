import { inlineReader } from "./inline";


export function csvReader({ path = "data.csv", keyConcepts = [] }) {

    return inlineReader({ 
        values: d3.csv(path), 
        keyConcepts 
    });
    
}