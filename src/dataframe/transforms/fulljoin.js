import { DataFrame } from "../dataFrame";

export function fullJoin(joinParams, joinKey = joinParams[0].dataFrame.key) {

    return joinParams.reduce(
        _fullJoin, 
        DataFrame([], joinKey)
    );

}

/**
 * Full join. Impure: Modifies left df. Left key is join key. Right key must contain all join key fields (can't use regular fields for joining).
 * @param {DataFrame} left DataFrame used as base for join
 * @param {*} rightCfg { dataFrame: DataFrame, projection: { origField: projField } }
 */
function _fullJoin(left, rightCfg) {
    // join or copy right rows onto result
    const joinKey = left.key;
    const dataKey = rightCfg.dataFrame.key;
    const projection = normalizeProjection(rightCfg.projection) || {};

    if (!joinKey.every(dim => dataKey.includes(dim)))
        console.warn("Right key does not contain all join fields.", { left: left, right: rightCfg });
    if (!projection || Object.keys(projection).length === 0)
        console.warn("No projection given for join so no new fields will be joined", { left: left, right: rightCfg } );

    for (let [keyStr, rightRow] of rightCfg.dataFrame) {
        const leftRow = getOrCreateRow(left, joinKey, rightRow, keyStr)  
        // project with aliases        
        for(let key in projection) {
            leftRow[projection[key]] = rightRow[key];
        }
    }

    return left;
}

// change array ["geo","year"] to { geo: "geo", year: "year" }
function normalizeProjection(projection) {
    if (!Array.isArray(projection))
        return projection;
    
    return projection.reduce((obj, field) => {
        obj[field] = field;
        return obj;
    }, {});
}

function createObj(space, row, keyStr) {
    const obj = {
        [Symbol.for('key')]: keyStr
    };
    space.forEach(dim => obj[dim] = row[dim])
    return obj;
}

function getOrCreateRow(df, keyArr, row, keyStr) {
    let obj;
    // if (keyStr == undefined) keyStr = createMarkerKey(row, keyArr);
    if (!df.hasByObjOrStr(row, keyStr)) {
        obj = createObj(keyArr, row, keyStr);
        df.setByKeyStr(keyStr, obj);
    } else {
        obj = df.getByObjOrStr(row, keyStr);
    }
    return obj;
}