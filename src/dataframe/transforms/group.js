import { DataFrame } from "../dataFrame";
import { relativeComplement, arrayEquals, createMarkerKey } from "../../core/utils";
import { DataFrameGroup } from "../dataFrameGroup";

export function group(df, groupBy, groupKey = df.key) {

    return DataFrameGroup(df, groupBy, groupKey);
    
}

