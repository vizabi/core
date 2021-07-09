
# MARKER
# Definition
A marker is a geometrical shape which represents one row in a [tidy data](https://vita.had.co.nz/papers/tidy-data.pdf) table. For example a bubble in a bubble chart, a line in a line chart or a bar in a bar chart. They can represent the male population of a country in a certain year, a flower observation or a student in a course in an academic quarter. Whatever the row in the data describes.

The term marker also denotes a model that describes the above mentioned geometrical shapes. To avoid confusion we can call them `marker items` and a `marker model`, but either can be shortened to just "marker", so judge from the context.

## API reference
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
- `marker.availability`: Concept availability array, composed from all data sources in dataSourceStore
- `marker.spaceAvailability`: Space availability array, composed from all data sources in dataSourceStore 
- `marker.id`: Returns the id as defined in config, such as "bubble"

### Methods
- `marker.getDataMapByFrameValue(Date)`: A DataFrame for a certain frame

```js
//try on tools page https://www.gapminder.org/tools/
viz.model.markers.bubble.getDataMapByFrameValue(new Date("2011"));
//--> Map(187) {"afg" => {…}, "ago" => {…}, "alb" => {…}, "and" => {…}, "are" => {…}, …}
```

- `marker.getTransformedDataMap(string)`: Helper function to get values from transformedDataMaps at some intermeidary stage in the transforms. And indeed, `marker.dataMap` is just a special case for `marker.getTransformedDataMap("final")`

```js
//get all frames of data
viz.model.markers.bubble.getTransformedDataMap("filterRequired")  
//--> Map(241) {"1800-01-01T00:00:00.000Z" => Map(184), "1801-01-01T00:00:00.000Z" => Map(184), "1802-01-01T00:00:00.000Z" => Map(184), …}
```

# How are marker items determined

Each marker item represents a row in the marker data. The marker data is determined as follows.

## Step 1: Full join marker space responses

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

## Step 2: Left join marker subspace responses

After that, responses from encodings using subspaces of the marker space, e.g. `color.space: ["geo"]`, are **left joined** to the marker data on their overlapping space. Left join means that no new marker items will be created from this operation.

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

## Step 3: Remove markers missing important encodings

Some encoding data is required to draw a marker, other data is not. For example, in a bubble chart, the x, y and size of the bubble are required, while the color is not (missing data is represented by a white bubble).

Thus, the marker config contains `requiredEncodings` property which is an array of important encodings. Let's say that in our case `marker.requiredEncodings: ["size", "x"]`. The resulting marker data would be:

| *geo* | _time_ | size | x    | color |
| ----- | ------ | ---- | ---- | ----- |
| usa   | 2017   | 300  | 600  |       |

Only the row where both `size` and `x` have data remains. And only that row will be returned as marker data and thus drawn as a marker item in the chart.