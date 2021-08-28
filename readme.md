# VIZABI DATA CORE

Vizabi data core uses [data visualization language](#configure-with-data-visualization-concepts) to configure data queries and transformations of [multidimensional data](#multi-dimensional-data). Its output is an array of objects representing a data table for use in other visualization libraries, such as vizabi-charts, d3, vega and others.

# Dependencies

Vizabi-data is built using MobX 5 for state management and expects it as a peer dependency, i.e. you include it on the page. It is not built in because this setup allows you to interact reactively with Vizabi-core [[docs]](https://mobx.js.org/configuration.html#isolateglobalstate-boolean) [[gh issue]](https://github.com/mobxjs/mobx/issues/1082).

Another peer dependency is D3, used mostly for scales, time parsing in csv files and some handy array functions. It is included as a peer dependency too because one is likely to already have it in the page for the purpose of visualisations.

# Usage 

Let `./data/readme.csv` have content as follows:

| country | year | income | life_expectancy | population | world_region |
|---------|------|--------|-----------------|------------|--------------|
| Sweden  | 1991 |  24253 |              78 |    8616729 |       Europe |
| Russia  | 1991 |  19600 |              69 |  148000000 |       Europe |
| ...     | ...  |  ...   |             ... |    ...     |          ... |

then by discribing a marker, feeding it to Vizabi and listening to its state we will get the same table prepared for data binding in visualisation:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/mobx/5.15.7/mobx.umd.min.js"></script>
<script src="https://d3js.org/d3.v6.min.js"></script>
<script src="Vizabi.js"></script>

<script>
    const marker = Vizabi.marker({
        data: {
            source: {
                path: './data/readme.csv',
                keyConcepts: ['country', 'year']
            },
            space: ['country', 'year']
        },
        encoding: {
            x: { data: { concept: 'income' } },
            y: { data: { concept: 'life_expectancy' } },
            size: { 
                data: { concept: 'population' },
                scale: { 
                    range: [1, 50] 
                }
            },
            color: { 
                data: { concept: 'world_region' },
                scale: {
                    domain: ['Africa', 'Americas', 'Asia', 'Europe'],
                    range: ['blue','green','red','yellow']
                }    
            }
        }
    })

    // You can use either MobX or traditional listeners to consume the output...
    marker.on('dataArray', console.log)

    // ...but when using mobx, only access properties when marker state is fulfilled
    mobx.autorun(() => marker.state == 'fulfilled' && console.log(marker.dataArray));
</script>
```

This will output a data array (notice the added key in Symbol and the renaming of columns):
```js
[{ 
    country: "Sweden", year: 1991, x: 24253, y: 78, size: 8616729, color: "Europe", Symbol(key): "Sweden¬1991"
}.{
    country: "Russia", year: 1991, x: 19600, y: 69, size: 148000000, color: "Europe", Symbol(key): "Russia¬1991"
}]
```

Use scales inside the models to resolve data values to visual properties:

```js
marker.encoding.size.scale.d3Scale(148000000) //--> 50
marker.encoding.color.scale.d3Scale("Europe") //--> "yellow"
```

Then, if we modify the state of the marker, for example, if we change `x` to also display `life_expectancy`:

```js
marker.encoding.x.data.config.concept = "life_expectancy"
```

The console.log inside `autorun` will run again and the output this time will be different:

```js
[{ 
    country: "Sweden", year: 1991, x: 78, y: 78, size: 8616729, color: "Europe", Symbol(key): "Sweden¬1991"
}.{
    country: "Russia", year: 1991, x: 69, y: 69, size: 148000000, color: "Europe", Symbol(key): "Russia¬1991"
}]
```


# Developing the project

Approved environment: node v14.17.1 npm v7.19.0

## Run a demo chart
clone, run `npm install`, then `npm start`,
see output at http://localhost:9000

## Run tests
run all tests  
`npm test`  

run a single test 
`npm test -- /config.test.js`  

run a single test with watch 
`npm test -- /config.test.js --watch`  

debug a single test with breakpoints in VS Code  
`npm run debug -- /config.test.js`  

## Build the bundle  
`npm run build`, see output in /dist/Vizabi.js 

## Pubishing
Upon publishing the package with `npm publish` it will automatically `npm test` && `npm run build` first

## Source code files overview, scale by file size
![image](https://user-images.githubusercontent.com/3648190/124941497-1fefbf80-e00b-11eb-9fdf-b6359bd7b421.png)

