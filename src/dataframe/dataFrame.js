import { normalizeKey, mapToObj } from "../core/utils";
import { order } from "./transforms/order";
import { fullJoin } from "./transforms/fulljoin";
import { DataFrameStorageMap } from "./storage/map";
import { DataFrameStorageLookups } from "./storage/lookups";
import { copyColumn } from "./transforms/copycolumn";
import { leftJoin } from "./transforms/leftjoin";
import { filter } from "./transforms/filter";
import { project } from "./transforms/project";
import { observable } from "mobx";

//df.get(["swe","2015"]).population

export const DataFrame = (data = [], key = []) => constructDataFrame(data, key, DataFrameStorageMap);
DataFrame.fromLookups = (concepts, key) => constructDataFrame(concepts, key, DataFrameStorageLookups);
DataFrame.fromArray = DataFrame;

function constructDataFrame(data, key, storageBuilderFn) {
    if (data.hasByObjOrStr) // duck-typing DataFrame
        return data;

    const df = {}
    df.key = normalizeKey(key);
    df.data = storageBuilderFn(data, df.key);
    df.fields = df.data.fields;

    // methods
    attachMethods(df);

    return df;
}

function attachMethods(df) {
    // transforms
    df.order = (direction) => order(df, direction); 
    df.leftJoin = (rightJoinParams) => leftJoin({ dataFrame: df }, rightJoinParams);
    df.fullJoin = (joinParams, key) => fullJoin([{ dataFrame: df }, ...joinParams], key);
    df.copyColumn = (src, dest) => copyColumn(df, src, dest);
    df.filter = (filterObj) => filter(df, filterObj);
    df.project = (projection) => project(df, projection);

    // has/get/set/info
    df.has = df.data.has;
    df.get = df.data.get;
    df.hasByObjOrStr = df.data.hasByObjOrStr;
    df.getByObjOrStr = df.data.getByObjOrStr;
    df.set = df.data.set;
    df.setByKeyStr = df.data.setByKeyStr;
    df.values = df.data.values;
    df.extent = (concept) => extent(df, concept);
    df.delete = df.data.delete;

    df[Symbol.iterator] = df.data[Symbol.iterator];
}

// in the style of d3.extent
function extent(df, concept) {
    let min, max, value, row;
    const iter = df.values();
    // find first comparable values
    for (row of iter) {
        if ((value = row[concept]) != null && value >= value) {
            min = max = value;
            break;
        }
    }
    // compare remaining values 
    for (row of iter) {
        if ((value = row[concept]) != null) {
            if (min > value) min = value;
            if (max < value) max = value;
        }
    }
    return [min, max];
}