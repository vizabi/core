import { DataFrameGroup, DataFrameMultiGroup } from "../dataFrameGroup";

export function groupBy(df, groupKey, memberKey = df.key) {

    return DataFrameGroup(df, groupKey, memberKey);
    
}

export function groupByWithMultiGroupMembership(df, groupKey, memberKey = df.key) {

    return DataFrameMultiGroup(df, groupKey, memberKey);
    
}
