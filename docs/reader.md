# Vizabi-to-reader API

## Purpose

Data can be served from different sources in different ways: CSV or Excel files, SQL databases, streaming APIs and so on. Vizabi uses readers in order to abstract that difference into a separate layer and handle those many ways, each would need its own reader. We already have readers for CSV files, Excel files, DDFCSV datasets, DDF API endpoints.

## Outline of communication and data flow

The communication then goes like this

1. user clicks a button that should change visualisation
  example: axis Y is showing "Life expectancy". User changed Y axis to show "CO2 emissions"
  
2. vizabi-component listens to button click and formulates a change in vizabi state, expressed in grammar of graphics
  example: before `y: {data: {concept: "lex"}}` after `y: {data: {concept: "co2"}}`

3. vizabi-data-layer then compares this to the data it already has locally, discovers that it should be loaded from reader and formulates a DDFQL request to the reader
  example: `{select: {key: ["country", "time"], value: "co2"}, from: "datapoints"}`

4. vizabi-reader then needs to translate this DDFQL expression and request data as agreed with the data source
  example: fetch a CSV file with name co2--by--country--time, parse it
  
5. vizabi-reader returns a promise, which is resolved when the data has arrived and got parsed

6. vizabi-data-layer waits for when the promise is resolved, then takes the data, does some transformations to it, notifies all components who use the relevant piece of state (expressed in grammar of graphics)

7. vizabi-component takes the new data and plots it on a chart upon notification
  example: co2 numbers turn into pixels

8. user sees an update chart
  example: axis Y is showing "CO2 emissions" now
  
## Setting up and using reader without Vizabi (standalone)
Download a reader as a file from here and include it as a <script> tag:  
`<script src="dist/vizabi-ddfservice-reader.js"></script>`

or install it from npm and include via import:  
`import * as DDFserviceReader from "ddf-service-reader"`

make an instance of the reader
`var reader = DDFServiceReader.getReader();`

init reader by setting its endpoint
`reader.init({service: 'https://big-waffle.gapminder.org', name: v.dataset});`

use reader by calling read function:


## Setting up and using reader with Vizabi

## API
### Reader.init(options)
Sets basic parameters to readers, such as dataset name and API endpoint. There is some diversity of parameters among readers. 
* ddfservice-reader
```
{
  service:
  name:
}
```
* csv-reader
```
{
  path:
  columnHasNames: 
}
```
* excel-reader
```
{
  path:
  sheet:
  columnHasNames: 
}
```
### Reader.read(query)
Reads data from the data source. Parameter `query` is expected in DDFQL format. Returns a promise, which is resolved with the desired data as an array of objects. Example:
```
reader.read({select: {key: ["concept"], value: ["name"]}, from: "concepts"})
  .then(result => console.error(result))
  .catch(error => console.error(error));
  
> [
{geo: "afg", time: Mon Mar 02 2020 17:52:19 GMT+0100 (Central European Standard Time), lex: "67.3"},
{geo: "afg", time: Mon Mar 02 2020 17:52:19 GMT+0100 (Central European Standard Time), lex: "67.3"},
{geo: "afg", time: Mon Mar 02 2020 17:52:19 GMT+0100 (Central European Standard Time), lex: "67.3"},
{geo: "afg", time: Mon Mar 02 2020 17:52:19 GMT+0100 (Central European Standard Time), lex: "67.3"},
...
]
```

### Reader.getAsset(assetName)
Fetches an asset from the dataset. Parameter `assetName` should be a string. Return a promise, which is resolved with the desired asset as an object. Example:
```
reader.getAsset("world-50m.json")
  .then(result => console.error(result))
  .catch(error => console.error(error));
  
> {paths: {...}, shapes: {...}}
```

### Reader.getDatasetInfo()
Allows to get properties of the dataset, such as name, author, last modified date, etc. Accepts no parameters and returns a promise, which is resolved with an object, like so:
```
reader.getDatasetInfo()
  .then(result => console.error(result))
  .catch(error => console.error(error));
  
> {name: "ddf--systema_globalis", author: "Gapminder", lastModified: ""}
```

## Distribution
Readers should be published in UMD format

## Parsing
Since all data comes as strings it needs to be parsed to numbers and dates  

### Missing data
"", null, undefined, NaN should not apprar in the resulting array

### Dates and times
how to detect them? by concept type? can there be ambiguity?  

### Floating point numbers
how to detect them? by concept type?  
how about , and . delimiters?  
how about scientific format?  
