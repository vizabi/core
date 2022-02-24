import { order } from "./transforms/order";
import { fullJoin } from "./transforms/fulljoin";
import { MapStorage } from "./storage/map";
import { LookupStorage } from "./storage/lookups";
import { copyColumn } from "./transforms/copycolumn";
import { leftJoin } from "./transforms/leftjoin";
import { filter, filterNullish } from "./transforms/filter";
import { project } from "./transforms/project";
import { addColumn } from "./transforms/addColumn";
import { groupBy, groupByWithMultiGroupMembership } from "./transforms/group";
import { interpolate } from "./transforms/interpolate";
import { reindex } from "./transforms/reindex";
import { fillNull } from "./transforms/fillnull";
import { extent } from "./info/extent";
import { unique } from "./info/unique";
import { copy } from "./transforms/copy";
import { differentiate } from "./transforms/differentiate"
import { interpolateBetween } from "./transforms/interpolateBetween";

const fromLookups = (concepts, key) => constructDataFrame(LookupStorage(concepts, key));
const fromArray = (data = [], key = data.key || []) => constructDataFrame(MapStorage(data, key));

export const DataFrame = fromArray;
DataFrame.fromLookups = fromLookups;
DataFrame.fromArray = fromArray;

function constructDataFrame(storage) {
    // https://medium.com/javascript-scene/the-hidden-treasures-of-object-composition-60cd89480381
    // compose storage and DF methods by concatenation 
    // concatenation instead of aggregation/delegation as there is no overlap in keys and 
    // we want the full storage API to be available on the DataFrame
    const df = Object.assign(storage,
        {        
            // transforms
            order: (direction) => order(df, direction), 
            leftJoin: (joinParams) => leftJoin({ dataFrame: df }, joinParams),
            fullJoin: (joinParams, key) => fullJoin([df, ...joinParams], key),
            copyColumn: (src, dest) => copyColumn(df, src, dest),
            filter: (filterObj) => filter(df, filterObj),
            filterNullish: (fields) => filterNullish(df, fields),
            project: (projection) => project(df, projection),
            addColumn: (name, value) => addColumn(df, name, value),
            groupBy: (groupKey, memberKey) => groupBy(df, groupKey, memberKey),
            groupByWithMultiGroupMembership: (groupKey, memberKey) => groupByWithMultiGroupMembership(df, groupKey, memberKey),
            interpolate: () => interpolate(df),
            interpolateTowards: (df2, mu, fields, interpolators) => interpolateBetween(df, df2, mu, fields, interpolators),
            reindex: (iterable) => reindex(df, iterable),
            fillNull: (fillValues) => fillNull(df, fillValues),
            copy: () => copy(df),
            differentiate: (xField) => differentiate(df, xField),
    
            // info
            extent: (concept, groupBy, groupSubset) => extent(df, concept, groupBy, groupSubset),
            unique: (concept) => unique(df, concept),
            type: 'DataFrame',
        
            // export
            toJSON: () => [...df.values()]
        },
        {
            filterGroups: (filterFn, inplace = false) => {
                return inplace ? df : df.copy();
            },
            setRow: (row, keyStr) => df.set(row, keyStr)
        }
    );

    return df;
}