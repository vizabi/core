import { DataFrameGroupMap } from "../dataFrameGroup";

export function groupBy(df, groupKey, memberKey = df.key) {

    return DataFrameGroupMap(df, groupKey, memberKey);
    
}

