# DataFrame

A DataFrame stores tabular data with indexed lookups and allows for easy grouping and transformation methods.

- [Constructor](#constructor)
  - [`DataFrame(data: iterable, key: string[]): DataFrame`](#dataframedata-iterable-key-string-dataframe)
- [Read/Write properties](#readwrite-properties)
  - [`df.key: string[]`](#dfkey-string)
- [Read only properties](#read-only-properties)
  - [`df.fields: string[]`](#dffields-string)
- [Methods](#methods)
  - [`df.order(order_by): DataFrame`](#dforderorder_by-dataframe)
    - [Parameters](#parameters)
    - [Examples](#examples)
  - [`df.leftJoin(joinParams): DataFrame`](#dfleftjoinjoinparams-dataframe)
    - [Parameters](#parameters-1)
    - [Returns](#returns)
    - [Examples](#examples-1)
  - [`df.fullJoin(joinParams, key): DataFrame`](#dffulljoinjoinparams-key-dataframe)
    - [Parameters](#parameters-2)
    - [Returns](#returns-1)
    - [Examples](#examples-2)
  - [`df.copyColumn(src, dest): DataFrame`](#dfcopycolumnsrc-dest-dataframe)
  - [`df.filter(filterObj): DataFrame`](#dffilterfilterobj-dataframe)
  - [`df.filterNullish(fields): DataFrame`](#dffilternullishfields-dataframe)
  - [`df.project(projection): DataFrame`](#dfprojectprojection-dataframe)
  - [`df.addColumn(name, value): DataFrame`](#dfaddcolumnname-value-dataframe)
  - [`df.groupBy(groupKey, memberKey): DataFrameGroup`](#dfgroupbygroupkey-memberkey-dataframegroup)
  - [`df.interpolate(): DataFrame`](#dfinterpolate-dataframe)
  - [`df.interpolateTowards(df2, mu): DataFrame`](#dfinterpolatetowardsdf2-mu-dataframe)
  - [`df.reindex(iterable): DataFrame`](#dfreindexiterable-dataframe)
  - [`df.fillNull(fillValues): DataFrame`](#dffillnullfillvalues-dataframe)
  - [`df.copy(): DataFrame`](#dfcopy-dataframe)

## Constructor
### `DataFrame(data: iterable, key: string[]): DataFrame` 
Returns a dataframe indexed to the given `key`, containing the `data`. 
   - `data` is any iterable (e.g. array, map.values()) of row objects. 
   - `key` is an array of data field headers.

## Read/Write properties

### `df.key: string[]`
Read or write dataframe `key` which data is indexed to.

## Read only properties

### `df.fields: string[]`
Array of fields in the dataframe (specifically in the first row, or just the key for empty dataframes)

## Methods

### `df.order(order_by): DataFrame`
Returns copy of `df` with reordered rows according to `order_by`.

#### Parameters
  - `order_by: (string|object)[]`: an array of fields or objects with field as key, direction as value. If array element is a field, direction will be ascending.

#### Examples
```
df.order([
    'country', 
    { year: 'descending' }, 
    { gender: 'ascending' }
])
```
 
### `df.leftJoin(joinParams): DataFrame`
Left join other dataframes onto the `df` in-place according to `joinParams`. 

#### Parameters
- `joinParams: joinParam[]`
  - `joinParam: object` object with properties `dataFrame` and `projection` 
    - `dataFrame` is the DataFrame to join. 
    - `projection` is an object with a source field on dataFrame as keys and an array of destination fields as values.

#### Returns 
`df` with the other dataframes joined. 

#### Examples
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

### `df.fullJoin(joinParams, key): DataFrame`
Full join `df` and dataframes onto eachother using `key` as join fields. `joinParams` can define exact projection of joined rows in additional dataframes. `df` will have no specific projection, all rows will be copied as is. Use standalone `fullJoin` to define projection for every dataframe.

#### Parameters
- `joinParams: DataFrame[] | joinParam[] |` Array of `DataFrame`s or Array of `joinParam`s
  - `joinParam: object` object with properties `dataFrame` and `projection`
    - `dataFrame: DataFrame` is the DataFrame to join. 
    - `projection: { key: string } | { key: string[] }` is an object with a source field on dataFrame as keys and an array of destination fields as values or one string for destination field.
- `key: string[]` An array of strings signifying fields to join on, defaults to `df.key`

#### Returns 
A new dataframe with new rows with joined rows of given dataframes

#### Examples

```
df.fullJoin([df2, df3])
```

```
df.fullJoin([{ 
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
Will full join `df`, `df2` and `df3`, so that `df` will have the field `population` from `df2` as fields `size` and `order`, `gdp_per_cap` from `df3` as `x` and `life_expectancy` from `df3` as `y`.

### `df.copyColumn(src, dest): DataFrame`
copy `src` column to a `dest` column

### `df.filter(filterObj): DataFrame`
filter out any rows that don't pass the `filterObj`

### `df.filterNullish(fields): DataFrame`
filter out any rows that are `null` or `undefined` for the given `fields`

### `df.project(projection): DataFrame`
create new dataframe with fields in `projection`

### `df.addColumn(name, value): DataFrame`
add a new field `name`. If `value` is a function, the field will be set to `value(row)`, otherwise it will be set to `value` itself. 

### `df.groupBy(groupKey, memberKey): DataFrameGroup`
Returns a DataFrameGroup, grouping `df` into multiple dataframes by `memberKey`.

### `df.interpolate(): DataFrame`
Interpolates dataframe over its key.

### `df.interpolateTowards(df2, mu): DataFrame`
Returns a new dataframe which is `mu` distance between `df` and `df2`.

### `df.reindex(iterable): DataFrame`
Reindexes dataframe according to `iterable`'s values. Adds rows when missing and reorders rows according to `iterables` order.

### `df.fillNull(fillValues): DataFrame`
Replaces `null`/`undefined` values according to `fillValues`, which is an object whose keys are field names, and values are functions, primitive values, or objects. If its a function value will be `value(row)`.

### `df.copy(): DataFrame`
Returns a copy of `df`. Does not create new row objects.
