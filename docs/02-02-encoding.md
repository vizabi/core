# ENCODING
# Definition
An encoding channel, or encoding for short, is a property of a marker which encodes *data* using a *scale*. Examples of properties are a bubble's color, size or x and y position on a grid. A different data value leads to (*encodes to*) a different color, size or x and y position of the bubble. A marker has different visual properties which can visually encode variables in the data. Which visual properties a marker has depends on the type of marker. For example, a circle has a radius, a bar has a width and height and a line a collection of x and y points.

# API reference
### Configurable Properties 
Write through `encoding.config`, read through `encoding`.
- `encoding.data`: a `DataConfig` object
- `encoding.scale`: a `Scale` object

### Read only properties:
- `encoding.state`: Current loading state of the encoding. Should be `fulfilled` before reading any other properties.
- `encoding.marker`: Returns the parent
- `encoding.id`: Returns the id as defined in config, such as "color" 

### Methods
- ⚠️ `encoding.setWhich(kv)`: _This method is semi-legacy and will likely be deprecated in the future._ All in one method for setting fields of encoding.dataConfig. The kv key-value argument should come in the form of

```js
//for setting a concept in space from a datasource
{
  key: ["country", "time"], 
  value: {concept: "population_total", dataSource: "sg"}
}
//for setting a constant
{
  key: null, 
  value: {concept: "_default_", dataSource: null}
}
```

# Examples
Encodings can also encode less obvious properties, such as designate what frame of an animation or small multiples plot a marker is shown in or what order the resulting data rows will be in (used for e.g. the marker's z-position).

In Gapminder's health and wealth chart, the marker is a circle. Each circle has data encoded in several visual properties:

Circle x position: Income - GDP per Capita PPP$
Circle y position: Life Expectancy at birth
Circle size: Population
Circle color: World Region (4 regions)
Circle order (or: z position): Population

In our online version we have additional encodings:

Circle animation frame: Year
Circle selected state: By user interaction
Circle highlighted state: By user interaction

An example of the health and wealth chart data is:

| country | year | gdp_per_cap | life_expectancy | population | world_4region |
| ------- | ---: | ----------: | --------------: | ---------: | ------------- |
| swe     | 2018 |       47500 |            82.4 |    9980000 | europe        |
| usa     | 2018 |       54900 |            79.1 |  327000000 | americas      |
| zam     | 2018 |        3870 |            59.5 |   17600000 | africa        |

Which, when mapped to the marker encodings forms the following marker data:

| country | year |     x |    y |      size | color    |     order | frame |
| ------- | ---: | ----: | ---: | --------: | -------- | --------: | ----- |
| swe     | 2018 | 47500 | 82.4 |   9980000 | europe   |   9980000 | 2018  |
| usa     | 2018 | 54900 | 79.1 | 327000000 | americas | 327000000 | 2018  |
| zam     | 2018 |  3870 | 59.5 |  17600000 | africa   |  17600000 | 2018  |



# How is encoding data resolved

An encoding model has a data model and a scale model.

Encoding can get data from two sources. 

1. From their own predefined data sources.
2. From the markers, which are build from other encodings

Selections should be able to select all markers in the visualization. Thus it should use the markers build from other encodings as data source.

However, we might want to make selections depend on properties as well (e.g. population > 10000). In that case, if this config is on marker, separate encodings might give back different markers because they have different datasources or different spaces.

## option 1

In that case, we want the selection be defined by one query to one dataset (or joining of multiple datasets). 

That would mean markers are defined in three steps:

1. Define marker subset to show.

   Definition is by criteria on marker keys.

   Three types of criteria:

   - Marker criterium. Specific marker key.
     These can be copied right away to other encoding queries.

   - Dimension criterium. Filter on dimension of marker. 
     These can be copied right away to other encoding queries.

   - Property criterium. Need to query to get dimension values for that property. 
     Those markers/dimension values are added to marker criterium.

2. Query full-space encodings with defined marker keys. Full join of results defines actual markers. Might be less than predefined marker keys because there might be no data for keys.

3. Query sub-space encodings with defined markers
   Subspace queries use domains of subspace dimensions in predefined markers.

## option 2

The other option would be that each encoding adds the property filter. If there's different data sources for encodings, they can return different markers because they have different properties (e.g. different population numbers).

Two steps for defining markers:

1. Query full space encodings which defines marker keys, using marker, dimension and property filter filters
2. Query sub-space encodings. If marker filter, use domain of markers. If dimension filter, apply relevant dimension filter. If property filter and property available, use property filter? Or skip property filter.