
# MODEL API
To configure properties, write to the corresponding `.config` property. E.g. to configure `data.concept` assign `data.config.concept = "population"`. Directly writing to properties is not possible, to make clear that a written value can differ from what you will read afterwards, due to processing of the configured value. E.g. a configured scale domain that gets changed due to `clampDomainToData: true`.

To configure Marker, Encoding, DataConfig, Scale and Filter objects themselves, write a plain object with their config. E.g. `marker.config.data = { space: ['geo','year'], filter: {} }`



# Vizabi.Marker
A marker is a geometrical shape which represents one row in a [tidy data](https://vita.had.co.nz/papers/tidy-data.pdf) table. For example a bubble in a bubble chart, a line in a line chart or a bar in a bar chart. They can represent the male population of a country in a certain year, a flower observation or a student in a course in an academic quarter. Whatever the row in the data describes.

### Configurable Properties
Write through `marker.config`, read through `marker`.
- `marker.data: DataConfig`: a `DataConfig` object
- `marker.encoding: object`: an object where each property contains an `Encoding` object
- `marker.requiredEncodings: Array<string>`: Array of encoding names which are required to have data. Markers with no data for a required encoding will be filtered out of the final result.
- `marker.transformations: Array<string>`: Array of strings referring to data transformation methods on Marker or Encodings which data will undergo to reach the final data table.

### Read-only properties
- `marker.state`: Current loading state of the marker. Should be `fulfilled` before reading any other properties.
- `marker.dataMap`: A DataFrame of the final data table of the marker
- `marker.dataArray`: An array of objects of the final data table of the marker



# Vizabi.Encoding
An encoding channel, or encoding for short, is a property of a marker which encodes *data* using a *scale*. Examples of properties are a bubble's color, size or x and y position on a grid. A different data value leads to (*encodes to*) a different color, size or x and y position of the bubble.

Encodings can also encode less obvious properties, such as designate what frame of an animation or small multiples plot a marker is shown in or what order the resulting data rows will be in (used for e.g. the marker's z-position).

### Configurable Properties 
Write through `encoding.config`, read through `encoding`.
- `encoding.data`: a `DataConfig` object
- `encoding.scale`: a `Scale` object

### Read only properties:
- `encoding.state`: Current loading state of the encoding. Should be `fulfilled` before reading any other properties.



# Vizabi.DataConfig (.data)
A DataConfig describes which data the encoding encodes. It points to a data `source` and describes what field (`concept`) and, if applicable, from what table (`space`) in the `source` the data comes and a `filter` defining a subset of rows. 

It is shorthanded to `.data` as `marker.data` and `encoding.data`.

### Configurable Properties
Write through `dataConfig.config`, read through `dataConfig`.
- `dataConfig.source: DataSource|string`: DataSource to fetch data from.
  - If `encoding.data.source` is not set, it inherits `marker.data.source`.
- `dataConfig.space: Array<string>`: Which table in source to fetch data from. 
  - If `encoding.data.space` is not set, it inherits `marker.data.space`.
  - `marker.data.space` is also the space a `encoding.data.space` needs to include to define markers/rows in the output.  
- `dataConfig.locale: string`: Change locale/language in which data will be fetched for sources which support this. 
  - If `encoding.data.locale` is not set, it inherits `marker.data.locale` if set or else `encoding.data.source.locale`.
- `dataConfig.concept: string`: Data field to use for this encoding. Only used for `encoding.data`.
- `dataConfig.constant: any`: Constant value to use instead of data. Will be used instead of data when set. Only used for `encoding.data`.
- `dataConfig.filter: Filter`: A `Filter` object defining a subset of markers through dimension (property) values or keys.
  - If `encoding.data.filter` is not set, it inherits `marker.data.filter`.
  
### Read only properties:
- `dataConfig.state`: Current loading state of the DataConfig. Should be `fulfilled` before reading any other properties.

  

# Vizabi.dataSource (.source)
Defines a source to fetch data from, which can be a file like csv or xls, a DDFCSV-dataset (a specially organised collection of csv files + datapackage.json), an onine database etc...  
During runtime vizabi can display data from multiple data sources and switch between them interactively. This is achieved by having multiple dataSource models defined in a "store", and then pointing the particular markers and encodings to the IDs of data sources.  

It is shorthanded to `.source` as `marker.data.source` and `encoding.data.source`.

### Configurable Properties
Write through `dataSource.config`, read through `dataConfig`. 
- `dataSource.modelType: string`: `ddfbw` | `cav` | `inline` | `ddfcsv` and any other reader that is implemented and added as model type to dataSourceStore
Other properties depend on `dataSource.modelType` and the reader — the implementation of that model type
- `ddfbw`
  - `dataSource.service: string`: a remote URL where the requests are to be sent. Example: "https://big-waffle.gapminder.org"
  - `dataSource.name: string`: dataset name. Example: "sg-master"
- `ddfcsv`
  - `dataSource.path: string`: a path to a local or remote DDFCSV dataset. Example: "./data/ddf--jheeffer--mdtest"
- `csv`
  - `dataSource.path: string`: a path to a local or remote csv file. Example: "./data/basic.csv"
  - `dataSource.sheet: string`: name of a sheet in google spreadsheets, only applicable if `dataSource.path` contains "https://docs.google.com/spreadsheets/". Example: "Sheet1"
  - `dataSource.keyConcepts: Array<string>`: headers of columns that are to be treated as a key. Example: ["geo", "year"].
- `inline`
  - `dataSource.values: Array<Object>`
- `other`
  - one can define more model types (readers)

### Read only  Properties
- `dataSource.state`: Current loading state of the DataSource. Should be `fulfilled` before reading any other properties. 



# Vizabi.Scale
A scale is the part of the encoding which maps a value in the data to a value useful to a visualization. For example, mapping population to a bubble diameter in pixels, world region to a color in RGB hex or GDP per capita to an x-axis position in pixels. For more info on types of scales, see [d3-scale](https://github.com/d3/d3-scale).

### Configurable Properties:
- `scale.domain: Array<any>`: The domain of the scale. Defaults to the `encoding.data.domain` if encoding has data. If data is set to constant, defaults to `encoding.range` if it is set, or `data.constant` value if range not set.
- `scale.range: Array<any>`: The range of the scale. Defaults to `[0,1]` for standard scales. If data is constant, defaults to `encoding.domain` to create an identity scale.
- `scale.zeroBaseLine: boolean`: Forces the scale to have a 0 in domain for continuous scales with one sided domains (i.e. only positive or only negative domain values). Can be used for e.g. bar chart heights or bubble sizes, where domains [should include 0](https://flowingdata.com/2015/08/31/bar-chart-baselines-start-at-zero/).
- `scale.type: ordinal|point|band|linear|log|genericLog|sqrt|time`: The type of the scale. Defaults to first type in `scales` concept property, `ordinal` for entity, string and boolean concepts or single-value domains, `time` for time concepts and otherwise `linear`.
- `scale.orderDomain: boolean`: Orders discrete (`ordinal`, `band`, `point`) domains. Defaults to true.
- `scale.clampDomainToData: boolean`: Clamps configured domain to data domain. Defaults to false.
- `scale.clamp: boolean`: Makes continuous scale clamp input values to domain. Defaults to false. See [d3-scale](https://github.com/d3/d3-scale#continuous_clamp).
### Read only properties:
- `scale.d3Scale`: Returns a [d3-scale](https://github.com/d3/d3-scale) object, which you can further use in the visualization as `d3Scale(x)` or as `d3Scale.invert(px)`



# Vizabi.Filter
A filter defines a selection of rows either through configuring the keys to single rows, or selecting key dimension (property) values, capturing multiple rows at once. 

## Working with individual marker items
Individual keys are stored in a map inside `filter.markers`

- `Boolean filter.any()`
- `Boolean filter.has(MarkerItem | Array<MarkerItem>)`
- `void filter.set(MarkerItem | Array<MarkerItem>)`
- `void filter.delete(MarkerItem | Array<MarkerItem>)`
- `void filter.toggle(MarkerItem | Array<MarkerItem>)`
- `void filter.clear()`

These are quite self-exlaining, but would be nice to give an example of these methods being used in a typical visualisation to implement highlight on hover and select on click interactions:

```js
autorun(() => {

  const selectedFilter = marker.encoding.selected.data.filter;
  const highlightFilter = marker.encoding.highlighted.data.filter;

  const selection = d3.selectAll("circle").data(marker.dataArray);

  selection.exit().remove();

  selection.enter().append("circle")
    .on("click", (event, d) => selectedFilter.toggle(d))
    .on("mouseover", (event, d) => highlightFilter.set(d))
    .on("mouseout", (event, d) => highlightFilter.delete(d));

  selection.update()
    .style("opacity", d => {
      if (highlightFilter.has(d)) return OPACITY_HIGHLIGHTED;
      if (selectedFilter.has(d)) return OPACITY_SELECTED;
      if (highlightFilter.any() || selectedFilter.any()) return OPACITY_DIMMED;
      return OPACITY_REGULAR;      
    })
}
```

## Working with slices of marker items degined by their dimensions 

to be described