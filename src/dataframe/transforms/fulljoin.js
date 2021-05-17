import { DataFrame } from "../dataFrame";
import { arrayEquals } from "../dfutils";

export function fullJoin(joinParams, joinKey = joinParams[0].dataFrame.key) {
    
    return joinParams
        .reduce((params, param) => {
            const baseParam = params.find(baseParam => baseParam.dataFrame === param.dataFrame);
            if (baseParam)
                Object.keys(param.projection).forEach(key => {
                    if (key in baseParam.projection) 
                        baseParam.projection[key].push(param.projection[key]);
                    else   
                        baseParam.projection[key] = [ param.projection[key] ]
                });
            else
                params.push(param);
            return params;
        }, [])
        .reduce(
            _fullJoin, 
            DataFrame([], joinKey)
        );

}

/**
 * Full join. Impure: Modifies left df. Left key is join key. Right key must contain all join key fields (can't use regular fields for joining).
 * @param {DataFrame} left DataFrame used as base for join
 * @param {*} rightCfg { dataFrame: DataFrame, projection: { origField: [ projFields, ... ] } }
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

    for (let keyStr of rightCfg.dataFrame.keys()) {
        const rightRow = rightCfg.dataFrame.getByStr(keyStr);
        const leftRow = getOrCreateRow(left, rightRow, keyStr)  
        // project with aliases        
        for(let key in projection) {
            for (let field of projection[key]) 
                leftRow[field] = rightRow[key];
        }
    }

    return left;
}

// change array ["geo","year"] to { geo: [ "geo" ], year: [ "year" ] }
function normalizeProjection(projection) {
    if (!Array.isArray(projection))
        return projection;
    
    return projection.reduce((obj, field) => {
        obj[field] = [ field ];
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

function getOrCreateRow(df, row, keyStr) {
    let obj;

    obj = df.getByStr(keyStr);
    if (obj === undefined) {
        obj = createObj(df.key, row, keyStr);
        df.set(obj, keyStr);
    }
    
    return obj;
}