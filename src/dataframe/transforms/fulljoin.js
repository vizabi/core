import { relativeComplement } from "../../core/utils";
import { DataFrame } from "../dataFrame";
import { arrayEquals, createKeyFn, isDataFrame, unique } from "../dfutils";

export function fullJoin(joinParams, joinKey = normalizeParam(joinParams[0]).dataFrame.key) {
    
    const normalizedParams = normalizeParams(joinParams);
    const result = normalizedParams.reduce(
            _fullJoin, 
            DataFrame([], joinKey)
        );

    // fill unjoined fields with explicit undefined
    const fields = unique(normalizedParams.map(param => Object.values(param.projection)).flat(2));
    for (const row of result.values()) {
        for (const field of fields) {
            if (!(field in row))
                row[field] = undefined;
        }
    }
    return result;

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
    const projection = rightCfg.projection;

    if (!joinKey.every(dim => rightCfg.dataFrame.fields.includes(dim)))
        console.warn("Right dataFrame does not contain all join fields.", { left, rightCfg });

    if (arrayEquals(joinKey, dataKey)) { 
        for (let keyStr of rightCfg.dataFrame.keys()) {
            const rightRow = rightCfg.dataFrame.getByStr(keyStr);
            const leftRow = getOrCreateRow(left, rightRow, keyStr)  
            // project with aliases        
            for(let key in projection) {
                for (let field of projection[key]) {
                    leftRow[field] = rightRow[key];
                }
            }
        }
    } else {
        const keyFn = createKeyFn(joinKey);
        for (let keyStr of rightCfg.dataFrame.keys()) {
            const rightRow = rightCfg.dataFrame.getByStr(keyStr);
            const leftKeyStr = keyFn(rightRow);
            const leftRow = getOrCreateRow(left, rightRow, leftKeyStr)  
            // project with aliases        
            for(let key in projection) {
                for (let field of projection[key]) 
                    leftRow[field] = rightRow[key];
            }
        }
    }

    return left;
}

// change array ["geo","year"] to { geo: [ "geo" ], year: [ "year" ] }
export function normalizeParams(params) {
    return params
        .map(normalizeParam)
        .reduce((params, param) => {
            const baseParam = params.find(baseParam => baseParam.dataFrame === param.dataFrame);
            if (baseParam)
                mergeProjections(baseParam, param);
            else
                params.push(param);
            return params;
        }, []);
}

function normalizeParam(param) {
    if (isDataFrame(param))
        param = { dataFrame: param }

    if (!("projection" in param))
        param.projection = relativeComplement(param.dataFrame.key, param.dataFrame.fields);

    if (!Array.isArray(param.projection))
        return param;
    
    param.projection = param.projection.reduce((obj, field) => {
        obj[field] = [ field ];
        return obj;
    }, {});
    return param;
}

function mergeProjections(destParam, sourceParam) {
    for (const [sourceField, destFields] of Object.entries(sourceParam.projection)) {
        if (sourceField in destParam.projection) 
            destParam.projection[sourceField].push(...destFields);
        else   
            destParam.projection[sourceField] = destFields;
    }
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