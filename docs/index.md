# Vizabi-data

Vizabi-data uses [data visualization language](#configure-with-data-visualization-concepts) to configure data queries and transformations of [multidimensional data](#multi-dimensional-data). Its output is an array of objects representing a data table for use in other visualization libraries, such as vizabi-charts, d3, vega and others.

Vizabi-data is built using MobX 5 for state management and expects it as a peer dependency, i.e. you include it on the page. It is not built in because this setup allows you to interact reactively with Vizabi-data [[docs]](https://mobx.js.org/configuration.html#isolateglobalstate-boolean) [[gh issue]](https://github.com/mobxjs/mobx/issues/1082). 

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/mobx/5.15.7/mobx.umd.min.js"></script>
<script src="Vizabi.js"></script>
```
In any case, you can use both MobX or traditional listeners to consume the output.
```js
const marker = Vizabi.marker({
    data: {
        source: {
            path: 'data.csv'
        }
    },
    encoding: {
        x: { data: { concept: 'income' } },
        y: { data: { concept: 'life_expectancy' } },
        size: { 
            data: { concept: 'population' } 
            scale: { 
                range: [1, 50] 
            }
        },
        color: { 
            data: { concept: 'world_region' } 
            scale: {
                domain: ['Africa', 'Americas', 'Asia', 'Europe'],
                range: ['blue','green','red','yellow']
            }    
        }
    }
})
marker.on('dataArray', console.log)
// when using mobx, only access properties when marker state is fulfilled
mobx.autorun(() => marker.state == 'fulfilled' && console.log(marker.dataArray));
```

# Configure with data visualization concepts
To configure properties, write to the corresponding `.config` property. E.g. to configure `data.concept` assign `data.config.concept = "population"`. Directly writing to properties is not possible, to make clear that a written value can differ from what you will read afterwards, due to processing of the configured value. E.g. a configured scale domain that gets changed due to `clampDomainToData: true`.

To configure Marker, Encoding, DataConfig, Scale and Filter objects themselves, write a plain object with their config. E.g. `marker.config.data = { space: ['geo','year'], filter: {} }`

## Vizabi.Marker
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

## Vizabi.Encoding
An encoding channel, or encoding for short, is a property of a marker which encodes *data* using a *scale*. Examples of properties are a bubble's color, size or x and y position on a grid. A different data value leads to (*encodes to*) a different color, size or x and y position of the bubble.

Encodings can also encode less obvious properties, such as designate what frame of an animation or small multiples plot a marker is shown in or what order the resulting data rows will be in (used for e.g. the marker's z-position).

### Configurable Properties 
Write through `encoding.config`, read through `encoding`.
- `encoding.data`: a `DataConfig` object
- `encoding.scale`: a `Scale` object

### Read only properties:
- `encoding.state`: Current loading state of the encoding. Should be `fulfilled` before reading any other properties.

## Vizabi.DataConfig (.data)
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
  
## Vizabi.Scale
A scale is the part of the encoding which maps a value in the data to a value useful to a visualization. For example, mapping population to a bubble diameter in pixels, world region to a color in RGB hex or GDP per capita to an x-axis position in pixels. For more info on types of scales, see [d3-scale](https://github.com/d3/d3-scale).

Configurable Properties:
- `scale.domain: Array<any>`: The domain of the scale. Defaults to the `encoding.data.domain` if encoding has data. If data is set to constant, defaults to `encoding.range` if it is set, or `data.constant` value if range not set.
- `scale.range: Array<any>`: The range of the scale. Defaults to `[0,1]` for standard scales. If data is constant, defaults to `encoding.domain` to create an identity scale.
- `scale.zeroBaseLine: boolean`: Forces the scale to have a 0 in domain for continuous scales with one sided domains (i.e. only positive or only negative domain values). Can be used for e.g. bar chart heights or bubble sizes, where domains [should include 0](https://flowingdata.com/2015/08/31/bar-chart-baselines-start-at-zero/).
- `scale.type: ordinal|point|band|linear|log|genericLog|sqrt|time`: The type of the scale. Defaults to first type in `scales` concept property, `ordinal` for entity, string and boolean concepts or single-value domains, `time` for time concepts and otherwise `linear`.
- `scale.orderDomain: boolean`: Orders discrete (`ordinal`, `band`, `point`) domains. Defaults to true.
- `scale.clampDomainToData: boolean`: Clamps configured domain to data domain. Defaults to false.
- `scale.clamp: boolean`: Makes continuous scale clamp input values to domain. Defaults to false. See [d3-scale](https://github.com/d3/d3-scale#continuous_clamp).

## Filter
A filter defines a selection of rows either through configuring the keys to single rows, or selecting key dimension (property) values, capturing multiple rows at once. 

# Multidimensional data

Multidimensional data is data where the same variable (or *concept*) is defined in multiple tables with different disaggregations (or *space*s). We call each part of the *space* a *dimension*. For example, the concept "population" can have data by country, by country and year, by country, year and gender, by country, year, gender and age etc.

`population` and `world_region` in the space, i.e. with dimension, `country`:
| country | population | world_region |
| ------- | ---------- | --- |
| Argentina | 45 000 000 | Americas |
| Sweden | 9 000 000 | Europe |
| ... |


`population` in the space, i.e. with dimensions, `country, year`: 
| country | year | population |
| ------- | --- | ---------- |
| Argentina | 2004 | 38 500 000 |
| Argentina | 2019 | 45 000 000 |
| Sweden | 2002 | 9 000 000 |
| Sweden | 2019 | 10 000 000 |
| ... |


`population` and `life_expectancy` in the space, i.e. with dimensions, `country, gender, year`:
| country | year | gender | population | life_expectancy |
| ------- | --- | ------- | --- | --- |
| Argentina | 2004 | male | 18 700 000 | 70.8 |
| Argentina | 2004 | female | 19 800 000 | 77.6 |
| Sweden | 2019 | male | 5 150 000 | 81.3 |
| Sweden | 2019 | female | 5 100 000 | 84.7 |
| ... |

With Vizabi Data and a *multdimensional* dataset like the one above it's very easy to, without any further data wrangling, create charts with data from all the different tables, in different combinations. For example:
- a bubble chart where each bubble represents a country (e.g. Sweden), and put 2002 male life expectancy on y-axis, 2019 female population on x-axis and color by country's world_region 
- a bubble chart where each bubble represents a country and year (e.g. Sweden in 2019), and put male life expectancy on y-axis, population on x-axis and color by country's world_region, and bubbles animate between years.
- a bubble chart where each bubble represents a gender in a country and year (e.g. Sweden's females in 2019), and have life expectancy on y-axis, population on x-axis (from any table you like) and color by country's world_region.

In other words, you can very easily: 
1. configure markers to represent any disaggregation (through `marker.space`)
2. encode data from any (other) disaggregation available onto them (through `encoding.space`, `encoding.concept` and `encoding.filter`)
3. switch between marker or encoding disaggregations on the fly (through changing either's `space`)

```js
Vizabi.marker({
    data: { 
        source: 'gapminder.csv',
        // each marker (i.e. row in table) represents a country in a year
        space: ['country','year'] 
    },
    encoding: {
        color: { data: {
            concept: 'world_region',
            // data from a subspace, will be joined with a left join
            space: ['country'] 
        } },
        size: { data: {
            concept: 'population'
            // space is implicitly the same as marker space, so country,year
        } },
        y: { data: {
            concept: 'life_expectancy'
            // data from a superspace
            space: ['country', 'year', 'gender'], 
            // filter dimension outside marker space to one value 
            // to prevent ambiguity in joining to marker space
            filter: {
                dimensions: {
                    gender: { gender: 'male' } 
                }
            }
        } },
        x: { data: {
            concept: 'GDP' // implicitly same space as marker
        } },
        frame: { data: {
            concept: 'year' // concept can also be in marker space itself
        } }
    }
})
```