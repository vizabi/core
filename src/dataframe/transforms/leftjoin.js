import { copyColumn } from "./copycolumn";
import { arrayEquals } from "../dfutils";
import { DataFrame } from "../dataFrame";
import { normalizeParams } from "./fulljoin";

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

    rights = normalizeParams(rights);
    rights.forEach(r => { 
        r.sameKey = arrayEquals(r.dataFrame.key, leftKey);
    });

    const result = DataFrame([], leftKey)

    for (let keyStr of leftDf.keys()) {
        const row = leftDf.getByStr(keyStr);
        // left row as base
        const leftRow = cloneRow(row);
        
        // join any rows in right dfs which have same key as left row
        for (let r of rights) {
            const rightRow = r.sameKey 
                ? r.dataFrame.getByStr(keyStr) 
                : r.dataFrame.get(row);
                
            for(let key in r.projection) {
                for (let field of r.projection[key]) 
                    leftRow[field] = rightRow[key];
            }
        }
        
        // set row
        result.set(leftRow, keyStr);
    }
    return result;
}

function joinRows(...rows) {
    return Object.assign(...rows);
}
function cloneRow(row) {
    return joinRows({}, row);
}
