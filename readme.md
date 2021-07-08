# VIZABI DATA CORE

Vizabi data core uses [data visualization language](#configure-with-data-visualization-concepts) to configure data queries and transformations of [multidimensional data](#multi-dimensional-data). Its output is an array of objects representing a data table for use in other visualization libraries, such as vizabi-charts, d3, vega and others.

# Dependencies

Vizabi-data is built using MobX 5 for state management and expects it as a peer dependency, i.e. you include it on the page. It is not built in because this setup allows you to interact reactively with Vizabi-data [[docs]](https://mobx.js.org/configuration.html#isolateglobalstate-boolean) [[gh issue]](https://github.com/mobxjs/mobx/issues/1082).

Another peer dependency is D3. Used mostly for scales and some handy array functions. It is included as a peer dependency too because one is likely to already have it in the page for the purpose of visualisations.

# Usage 

Let `data.csv` have content as follows:
| country | year | income | life_expectancy | population | world_region |
|---------|------|--------|-----------------|------------|--------------|
| Sweden  | 1991 |  24253 |              78 |    8616729 |       Europe |
| ...     | ...  |  ...   |             ... |    ...     |          ... |


```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/mobx/5.15.7/mobx.umd.min.js"></script>
<script src="Vizabi.js"></script>

<script>
    const marker = Vizabi.marker({
        data: {
            source: {
                path: 'data.csv'
            },
            space: ['country', 'year']
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

    // You can use either MobX or traditional listeners to consume the output...
    marker.on('dataArray', console.log)

    // ...but when using mobx, only access properties when marker state is fulfilled
    mobx.autorun(() => marker.state == 'fulfilled' && console.log(marker.dataArray));
</script>
```

# Developing the project

## Run a demo chart
clone, run `npm install`, then `npm start`,
see output at http://localhost:9000

## Run tests
`npm test`

## Build the bundle  
`npm run build`, see output in /dist/Vizabi.js 

## Pubishing
Upon publishing the package with `npm publish` it will automatically `npm test` && `npm run build` first

## Source code files overview, scale by file size
![image](https://user-images.githubusercontent.com/3648190/124941497-1fefbf80-e00b-11eb-9fdf-b6359bd7b421.png)

