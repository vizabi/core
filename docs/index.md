# Vizabi-data

Vizabi-data uses [data visualization language](#configure-with-data-visualization-concepts) to configure data queries and transformations of [multidimensional data](#multi-dimensional-data). It's output is an array of objects representing a data table for use in other visualization libraries, such as vizabi-charts, d3, vega and others.

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
To configure properties, write to the corresponding .config property. E.g. to configure `data.concept` do `data.config.concept = "population"`. 

## Marker
A marker is a geometrical shape which represents one row in a [tidy data](https://vita.had.co.nz/papers/tidy-data.pdf) table. For example a bubble in a bubble chart, a line in a line chart or a bar in a bar chart. They can represent the male population of a country in a certain year, a flower observation or a student in a course in an academic quarter. Whatever the row in the data describes.

Configurable Properties:
- `Marker.data`: a `DataConfig` object
- `Marker.encoding`: an object where each property contains an `Encoding` object

## Encoding
An encoding channel, or encoding for short, is a property of a marker which encodes *data* using a *scale*. Examples of properties are a bubble's color, size or x and y position on a grid. A different data value leads to (*encodes to*) a different color, size or x and y position of the bubble.

Encodings can also encode less obvious properties, such as designate what frame of an animation or small multiples plot a marker is shown in or what order the resulting data rows will be in (used for e.g. the marker's z-position).

Configurable Properties:
- `Encoding.data`: a `DataConfig` object
- `Encoding.scale`: a `Scale` object

## DataConfig (.data)
A DataConfig describes which data the encoding encodes. It points to a data `source` and describes what field (`concept`) and, if applicable, from what table (`space`) in the `source` the data comes and a `filter` defining a subset of rows. 

Configurable Properties:
- `DataConfig.source: DataSource|string`: DataSource to fetch data from.
  - If `encoding.data.source` is not set, it inherits `marker.data.source`.
- `DataConfig.space: Array<string>`: Which table in source to fetch data from. 
  - If `encoding.data.space` is not set, it inherits `marker.data.space`.
  - `marker.data.space` is also the space a `encoding.data.space` needs to include to define markers/rows in the output.  
- `DataConfig.locale: string`: Change locale/language in which data will be fetched for sources which support this. 
  - If `encoding.data.locale` is not set, it inherits `marker.data.locale` if set or else `encoding.data.source.locale`.
- `DataConfig.concept: string`: Data field to use for this encoding. Only used for `encoding.data`.
- `DataConfig.constant: any`: Constant value to use instead of data. Will be used instead of data when set. Only used for `encoding.data`.
- `DataConfig.filter: Filter`: A `Filter` object defining a subset of markers through dimension (property) values or keys.
  - If `encoding.data.filter` is not set, it inherits `marker.data.filter`.
  
## Scale
A scale is the part of the encoding which maps a value in the data to a value useful to a visualization. For example, mapping population to a bubble diameter in pixels, world region to a color in RGB hex or GDP per capita to an x-axis position in pixels. For more info on types of scales, see [d3-scale](https://github.com/d3/d3-scale).

Configurable Properties:
- `Scale.domain: Array<any>`: The domain of the scale. Defaults to the `Encoding.data.domain`.
- `Scale.range: Array<any>`: The range of the scale. Defaults to `[0,1]` for standard scales.
- `Scale.zeroBaseLine: boolean`: Forces the scale to have a 0 in domain for continuous scales with one sided domains (i.e. only positive or only negative domain values). Can be used for e.g. bar chart heights or bubble sizes, where domains [should include 0](https://flowingdata.com/2015/08/31/bar-chart-baselines-start-at-zero/).
- `Scale.type [ordinal|point|band|linear|log|genericLog|sqrt|time]`: The type of the scale. Defaults to first type in `scales` concept property, `ordinal` for entity, string and boolean concepts or single-value domains, `time` for time concepts and otherwise `linear`.
- `Scale.orderDomain: boolean`: Orders discrete (`ordinal`, `band`, `point`) domains. Defaults to true.
- `Scale.clampDomainToData: boolean`: Clamps configured domain to data domain. Defaults to false.
- `Scale.clamp: boolean`: Makes continuous scale clamp input values to domain. Defaults to false. See [d3-scale](https://github.com/d3/d3-scale#continuous_clamp).

## Filter
A filter defines a selection of rows either through selecting the keys of single rows, or selecting key dimension (property) values, capturing multiple rows at once. 

# Multidimensional data

Multidimensional data is data where the same variable (or `concept`) is defined in multiple tables with different disaggregations (or `spaces`/primary keys). For example, the concept "population" can have data by country or by country and year or by country, year and gender, or by country, year, gender and age etc.


| country | population | world_region |
| ------- | ---------- | --- |
| Sweden | 9 000 000 | Europe |
| Argentina | 45 000 000 | Americas |

Population and world_region per country

| country | year | population |
| ------- | --- | ---------- |
| Sweden | 2002 | 9 000 000 |
| Sweden | 2019 | 10 000 000 |
| Argentina | 2020 | 45 000 000 |
| Argentina | 2004 | 38 500 000 |

Population by country and year

| country | year | gender | population | life_expectancy |
| ------- | --- | ------- | --- | --- |
| Sweden | 2019 | male | 5 150 000 | 81.3 |
| Sweden | 2019 | female | 5 100 000 | 84.7 |
| Argentina | 2004 | male | 18 700 000 | 70.8 |
| Argentina | 2004 | female | 19 800 000 | 77.6 |

Population and life expectancy by country, gender and year

Vizabi Data supports this data model first hand. This means it's very easy to create markers in one space (e.g. one bubble represents Sweden in 2019) and encode data from other spaces on it.

```js
Vizabi.marker({
    data: { 
        source: 'gapminder',
        space: ['country','year'] 
    },
    encoding: {
        color: { data: {
            concept: 'world_region',
            space: ['country'] // data from a subspace
        } },
        size: { data: {
            concept: 'population'
            // space is implicitly the same as marker space, so country,year
        } },
        y: { data: {
            concept: 'life_expectancy'
            space: ['country', 'year', 'gender'], // data from a superspace
            // filter dimension outside marker space to one value 
            // to prevent ambiguity in joining to marker space
            filter: {
                dimensions: {
                    gender: 'male' 
                }
            }
        } },
        x: { data: {
            concept: 'GDP' // implicit same space as marker
        } },
        frame: { data: {
            concept: 'year' // concept can also be in marker space
        } }
    }
})
```