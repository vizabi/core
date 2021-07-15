# MULTIDIMENSIONAL DATA

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

With Vizabi data core and a *multdimensional* dataset like the one above it's very easy to, without any further data wrangling, create charts with data from all the different tables, in different combinations. For example:
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