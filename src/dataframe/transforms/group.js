import { DataFrameGroup } from "../dataFrameGroup";

export function groupBy(df, groupKey, memberKey = df.key) {

    return DataFrameGroup(df, groupKey, memberKey);
    
}

