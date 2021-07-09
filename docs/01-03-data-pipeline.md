
# DATA PIPELINE
# Main quest: data getting requested

## How to trigger data load
Create a marker
In order to trigger the data pipeline we need to 
listen to state == fulfilled and dataArray in a reactive context, like mobx.autorun
	One could listen to just dataArray, but will get errors at first until state becomes fulfilled

## State observation propagates
### marker.js
—> marker state `get state()`

### encoding.js 
—> encodings state `get state()`

### dataConfig.js
—> data config state `get state()`  
This also checks `source.conceptsState()`, which results in concepts being loaded. Loading concepts in turn results in availability being loaded. See the two side quests for that.

## A trick with response promise
—> `get responseState()`  
—> `get responsePromise()`  
A computed `responsePromise` is a tricky thing. By using `mobx-utils.fromPromise()` we create a Mobx own version of Promise, that is always pending, but the state inside of it is changing. The dataConfig.response and dataConfig.responseState are computeds, returning `responsePromise.value`, and `responsePromise.state`, which always reflect the latest request. This makes sure we always listen to the latest promise and allows us to have a single dataConfig—>encoding—>marker state on the outside while we override the promise inside.

> Tip: search repo for fromPromise to see where vizabi ever fetches the data

Here `responsePromise` sends the async request and returns the `fromPromise()` of the request. 
—> `get fetchResponse()`

## Queries
At this point the state observation has propagated down to where it finally touches the queries.
—> `this.source.query(this.ddfQuery)`

`ddfQuery` is a computed that uses `dataConfig.createQuery()` method, this is where all the `select`, `where`, `from`, etc clauses are filled in

Example of `ddfQuery`
```js
from: "datapoints"
language: "en"
select: {key: ["country", "time"], value: ["population_total"]}
where: {country.un_state: true, time: "2019"}
```

### dataSource.js
—> `query(query)`  
Adapters: dot to join, add explicit and

dotToJoin converts
```js
where: {country.un_state: true, time: "2019"}
```
to
```js
where: {time: "2019", country: "$country"}
join: {
  $country:{
    key: "country"
    where: {un_state: true}
  }
}
```
addExplicitAnd converts
```js
where: {country.un_state: true, time: "2019"}
```
to
```js
where: {
  $and: [{time: "2019"}, {country: "$country"}]
}
```
we can get rid of those by making readers and WS support the query in the form before adapters

—> `combineAndSendQueries(query)`  
If query already exists in cache, then returns it

—> `sendDelayedQuery(query)`  
—> `reader.read(query)`
```js
response //--> (195) [{…}, {…}, {…}, …]
0: {country: "afg", time: Tue Jan 01 2019 01:00:00 GMT+0100 (CEST), population_total: 38041757}
1: {country: "ago", time: Tue Jan 01 2019 01:00:00 GMT+0100 (CEST), population_total: 31825299}
2: {country: "alb", time: Tue Jan 01 2019 01:00:00 GMT+0100 (CEST), population_total: 2880913}
```
—> `normaliseResponse`  
creates a DataFrame for a common space of encoding and marker: guarantees that each key resolves to one marker item
reader API is not completely stable, creates a DF if it isn’t one already (DF is a map with extra functions, it creates an index on the key so it’s quicker to access)
The returned object is not a DF yet, but an function that can create a DF for a given key (space) later

```js
response //→ {raw: Array(195), forKey: ƒ, forQueryKey: ƒ}
```

## Concept side quest
Concepts branch
dataConfig.js
—> `get state()` 
—> `source.conceptsState()`

dataSource.js
—> `get conceptsState()`
—> `get conceptsPromise()`
—> `get fetchConcepts()`
This waits for availability to be loaded in fromPromise(this.availabilityPromise.then(...))
—> `query(query)`

## Availability side quest
dataSource.js
—> `get fetchConcepts()`
—> `get availabilityPromise()`
—> `query(query)` 3 times


# Main quest: data comes from the reader
### dataConfig.js
—> `get response()`
This is where the data comes back from responsePromise: see how `fetchResponse()` ends with .then(response => response.forKey(this.commonSpace))  

`commonSpace` is the overlap between marker space and encoding space. This will create a dataframe, so the output looks like this 

```js
Map(195) {"afg¬2019-01-01T00:00:00.000Z" => {…}, "ago¬2019-01-01T00:00:00.000Z" => {…}, "alb¬2019-01-01T00:00:00.000Z" => {…}, …}
```
And every value of map comes in the form of d (MarkerItemData)
```js
{
  country: "afg",
  population_total: 38041757,
  time: Tue Jan 01 2019 01:00:00 GMT+0100 (Central European Standard Time) {},
  Symbol(key): "afg¬2019-01-01T00:00:00.000Z"
}
```


marker.js  
—> `get state()`  
triggers this.dataMapCache or dataMap (which through transformations also leads to dataMapCache)  

—> `get dataMapCache()` 
Each encoding has its own response (which might come from the same combined query to a datasource and they might be in the same dataframe if the key is the same). Marker model combines all encoding responses in its dataMapCache. The combination should result in a table of marker items. We have 2 types of encs: defining marker and amending marker. Combination happens with joining via fullJoin and leftJoin. Renaming (projection) happens while joining.

A third type of encoding are encodings that don’t do anythin (no-op), such as select and highlight, they don’t modify data. 

—> `get transformedDataMaps()`

Transformations can be defined on a marker level or on an encoding level (Some encodings need to do transformations on the data)
- Frame encoding wants to group, interpolate, extrapolate
- Order encoding wants to change order
- Trail encoding adds trails from previous frames
- Marker wants to filter marker items by required encodings, removing those that don't have data

The order of transformations is saved in a configurable array of strings.

[get transformationFns()]
If there is no dot, we look for the function on the marker, if there is we look for a function on encoding

Transformations can rerun partially, because they are run in boxed ccomputed and the result is saved

How to use boxed computeds: `prevResult.get()` actually is what triggers the computation

Transformations are being run backwards: data is pulled, not pushed through transformations

—> `get datamap()`
datamap is a bunch of transformations that happened on datamapcache in a certain order

—> `get dataArray()`
