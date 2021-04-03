import { copyColumn } from "./copycolumn";
import { arrayEquals } from "../dfutils";
import { DataFrame } from "../dataFrame";

        // TODO: add check for non-marker space dimensions to contain only one value
        // -> save first row values and all next values should be equal to first

/**
 * Join right on left with overlapping columns of key as join columns.
 * @param {*} left 
 * @param  {...any} rights 
 */
export function leftJoin(left, rights) {
    const leftDf = left.dataFrame;
    const leftKey = leftDf.key;
    
    const rightCopies = rights.filter(r => leftKey.some(d => d in r.projection));
    rights = rights.filter(r => !rightCopies.includes(r)).map(r => { 
        const sameKey = arrayEquals(r.dataFrame.key, leftKey);
        r.hasFn = sameKey ? "hasByObjOrStr" : "has";
        r.getFn = sameKey ? "getByObjOrStr" : "get";
        return r;
    });

    const result = DataFrame([], leftKey)

    for (let [keyStr, row] of leftDf) {
        // left row as base
        const leftRow = cloneRow(row);
        
        // join any rows in right dfs which have same key as left row
        for (let { dataFrame, projection, hasFn, getFn } of rights) {
            if (dataFrame[hasFn](row, keyStr)) {
                const rightRow = dataFrame[getFn](row, keyStr);
                for(let key in projection) {
                    for (let field of projection[key]) 
                        leftRow[field] = rightRow[key];
                }
            }
        }
        
        // set row
        result.set(leftRow, keyStr);
    }
    for (let right of rightCopies) {
        // weird chrome bug: using for(let col in right.projection) in combination with 
        // assigning right.projection[col] to var or passing into function crashes chrome
        // therefore for...of w/ object.keys
        // for(let col in right.projection) {
        for (let col of Object.keys(right.projection)) { 
            copyColumn(result, col, right.projection[col]); 
        }   
    }
    return result;
}

function joinRows(...rows) {
    return Object.assign(...rows);
}
function cloneRow(row) {
    return joinRows({}, row);
}
