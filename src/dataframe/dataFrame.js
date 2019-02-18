import { normalizeKey } from "../core/utils";
import { order } from "./transforms/order";
import { fullJoin } from "./transforms/fulljoin";
import { DataFrameStorageMap } from "./storage/map";
import { DataFrameStorageLookups } from "./storage/lookups";
import { copyColumn } from "./transforms/copycolumn";
import { leftJoin } from "./transforms/leftjoin";

//df.get(["swe","2015"]).population

export const DataFrame = (data = [], key = []) => constructDataFrame(data, key, DataFrameStorageMap);
DataFrame.fromLookups = (concepts, key) => constructDataFrame(concepts, key, DataFrameStorageLookups);
DataFrame.fromArray = DataFrame;

function constructDataFrame(data, key, storageBuilderFn) {
    const df = {};

    df.key = normalizeKey(key);
    df.data = storageBuilderFn(data, df.key);
    attachMethods(df);

    return df;
}

function attachMethods(df) {
    df.order = (direction) => order(df, direction); 
    df.leftJoin = (rightJoinParams) => leftJoin({ dataFrame: df }, rightJoinParams);
    df.fullJoin = (joinParams, key) => fullJoin([{ dataFrame: df }, ...joinParams], key);
    df.copyColumn = (src, dest) => copyColumn(df, src, dest);
    df.has = df.data.has;
    df.get = df.data.get;
    df.hasByObjOrStr = df.data.hasByObjOrStr;
    df.getByObjOrStr = df.data.getByObjOrStr;
    df.set = df.data.set;
    df.setByKeyStr = df.data.setByKeyStr;
    df.values = df.data.values;
    df.delete = df.data.delete;
    df[Symbol.iterator] = df.data[Symbol.iterator];
}
