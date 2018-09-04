# Markers

A marker is a visual entity which represents a (statistical) population. Each population is represented by one row in the data. Thus each marker corresponds to one row in the data. Each population is uniquely identified by a key, consisting of one or more concepts (variables). The concepts that form the key are defined in the marker `space` array. 

For example in a certain bubble chart, one bubble represents Swedish males in 2017 (space: `["country", "gender", "year"]`). Or in another chart, a bar represents the HR division in Microsoft in May of 2018 (space: `["division", "company", "month"]`). Note that populations in the statistical sense don't have to be people. They can be cars, door knobs or even ideas. 

## Visual encoding

A marker has different visual properties which can visually encode variables in the data. Which visual properties a marker has depends on the type of marker. For example, a circle has a radius, a bar has a width and height and a line a collection of x and y points.

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

## How are markers determined

Each marker represents a row in the marker data. The marker data is determined as follows.

### Step 1: Full join marker space responses

At first, the marker data is a **full join** of the responses from encodings using the same space as marker. The full join is on the marker space (i.e. the responses' key). In the marker data the headers for the encodings are used instead of the data concepts. Encodings have unique names while concepts do not necessarily (e.g. male population & female population are both `population` with a different filter on the `gender` dimension).

size encoding response:

| *geo* | *time* | population |
| ----- | ------ | ---------- |
| usa   | 2017   | 300        |
| chn   | 2017   | 1300       |

x encoding response:

| *geo* | *time* | gdppcap |
| ----- | ------ | ------- |
| usa   | 2017   | 600     |
| swe   | 2017   | 800     |

marker data:

| *geo* | *time* | size | x    |
| ----- | ------ | ---- | ---- |
| usa   | 2017   | 300  | 600  |
| chn   | 2017   | 1300 |      |
| swe   | 2017   |      | 800  |

### Step 2: Left join marker subspace responses

After that, responses from encodings using subspaces of the marker space, e.g. `color.space: ["geo"]`, is **left joined** to the marker data on their overlapping space. Left join means that no new markers will be created from this operation.

color encoding response:

| _geo_ | world_4region |
| ----- | ------------- |
| chn   | asia          |
| swe   | europe        |
| ukr   | europe        |

marker data:

| *geo* | _time_ | size | x    | color  |
| ----- | ------ | ---- | ---- | ------ |
| usa   | 2017   | 300  | 600  |        |
| chn   | 2017   | 1300 |      | asia   |
| swe   | 2017   |      | 800  | europe |

As you can see, the color encoding response `geo: ukr, world_4region: europe` is not joined to the marker data, because there was no row with `geo: ukr` in the marker data. This is the result of **left** joining instead of **full** joining.

### Step 3: Remove markers missing important encodings

Some encoding data is required to draw a marker, other data is not. For example, in a bubble chart, the x, y and size of the bubble are required, while the color is not (missing data is represented by a white bubble).

Thus, the marker config contains an `important` property which is an array of important encodings. Let's say that in our case `marker.important: ["size", "x"]`. The resulting marker data would be:

| *geo* | _time_ | size | x    | color |
| ----- | ------ | ---- | ---- | ----- |
| usa   | 2017   | 300  | 600  |       |

Only the row where both `size` and `x` have data remains. And only that row will be returned as marker data and thus drawn as a marker in the chart.