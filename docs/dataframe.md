# DataFrame

A DataFrame stores tabular data with indexed lookups and allows for easy grouping and transformation methods.

## Constructor
 - `DataFrame(data: iteratable, key: string[])`: Returns a dataframe indexed to the given `key`, containing the `data`. 
   - `data` is any iterable (e.g. array, map.values()) of row objects. 
   - `key` is an array of data field headers.

## Read/Write properties

### `df.key: string[]`
Read or write dataframe `key` which data is indexed to.

## Read only properties

### `df.fields: string[]`
Array of fields in the dataframe (specifically in the first row, or just the key for empty dataframes)

## Methods

### `df.order(order_by)`
Returns copy of `df` with reordered rows according to `order_by`.

  - `order_by: (string|object)[]`: an array of fields or objects with field as key, direction as value. If array element is a field, direction will be ascending.

```
df.order([
    'country', 
    { year: 'descending' }, 
    { gender: 'ascending' }
])
```
 
### `df.leftJoin(joinParams)`
Left join other dataframes onto the dataframe according to `joinParams`. 

- `joinParams: joinParam[]`
  - `joinParam: object` object with properties `dataFrame` and `projection` 
    - `dataFrame` is the DataFrame to join. 
    - `projection` is an object with a source field on dataFrame as keys and an array of destination fields as values.


```
df.leftJoin([{ 
        dataFrame: df2, 
        projection: { 
            population: ['size', 'order'] 
        } 
    }, {
        dataFrame: df3,
        projection: {
            gdp_per_cap: ['x'],
            life_expectancy: ['y']
        }
    } 
])
```
Will left join `df2` on `df`, copying the field `population` from `df2` on to fields `x` and `y` in `df`.
### `df.fullJoin(joinParams, key)`
Full join other dataframes with the dataframe
- `df.copyColumn(src, dest): DataFrame`: copy `src` column to a `dest` column
- `df.filter(filterObj): DataFrame`: filter out any rows that don't pass the `filterObj`
- `df.filterNullish(fields): DataFrame`: filter out any rows that are `null` or `undefined` for the given `fields`
- `df.project(projection): DataFrame`: create new dataframe with fields in `projection`
- `df.addColumn(name, value): DataFrame`: add a new field `name`. If `value` is a function, the field will be set to `value(row)`, otherwise it will be set to `value` itself. 
- `df.groupBy(groupKey, memberKey): DataFrame`: Returns a DataFrameGroup, grouping `df` into multiple dataframes by `memberKey`.
- `df.interpolate(): DataFrame`: Interpolates dataframe over its key.
- `df.interpolateTowards(df2, mu): DataFrame`: Returns a new dataframe which is `mu` distance between `df` and `df2`.
- `df.reindex(iterable): DataFrame`: Reindexes dataframe according to `iterable`'s values. Adds rows when missing and reorders rows according to `iterables` order.
- `df.fillNull(fillValues): DataFrame`: Replaces `null`/`undefined` values according to `fillValues`, which is an object whose keys are field names, and values are functions, primitive values, or objects. If its a function value will be `value(row)`.
- `df.copy(): DataFrame`: Returns a copy of `df`. Does not create new row objects.