
# DATA PIPELINE
# Main quest: data getting requested

## How to trigger data load
Create a marker
```js
const marker = Vizabi.marker({
  data: {
    source: { path: 'data.csv' },
  },
  encoding: {
    x: { data: { concept: 'population_total' } }
  }
})
```

In order to trigger the data pipeline, listen to state == fulfilled and dataArray in a reactive context, like mobx.autorun

```js
mobx.autorun(() => marker.state == 'fulfilled' && console.log(marker.dataArray));
```
> (One could listen to just dataArray, but will get errors at first until state becomes fulfilled)

This will output a data array 
```js
[ 
  {country: "afg", year: 2019, x: 38041757, Symbol(key): "afg¬2019"},
  {country: "ago", year: 2019, x: 31825299, Symbol(key): "ago¬2019"},
  {country: "alb", year: 2019, x: 2880913, Symbol(key): "alb¬2019"}
]
```
But how does the data go through? Let's take it step by step.

## State observation propagates
### ====== marker.js ======
—> marker state `get state()`  
When you listen to marker state it needs to resolve it from a computed getter (getters are always computed). Marker state depends on the state of all encodings, so it checks their states...

### ====== encoding.js ======
—> encodings state `get state()`  
Encoding state depends on dataConfig state, so it checks further...

### ====== dataConfig.js ======
—> data config state `get state()`  

## A trick with responsePromise
—> `get responseState()`  
—> `get responsePromise()`  
—> `get fetchResponse()`
Here `fetchResponse()` sends the async request and returns the `fromPromise()` of the request. A computed `responsePromise` is a tricky thing. By using `mobx-utils.fromPromise()` we create a Mobx own version of Promise, that is always pending, but the state inside of it is changing. The dataConfig.response and dataConfig.responseState are computeds, returning `responsePromise.value`, and `responsePromise.state`, which always reflect the latest request. This makes sure we always listen to the latest promise and allows us to have a single dataConfig—>encoding—>marker state on the outside while we override the promise inside.

> Tip: search repo for `fromPromise` to see where vizabi ever fetches the data

dataConfig get state() also checks `source.conceptsState()`, which results in concepts being loaded. Loading concepts in turn results in availability being loaded. See the two side quests for that.

## Queries
At this point the state observation has propagated down to where it finally touches the queries: `this.source.query(this.ddfQuery)`. `ddfQuery` is a computed that uses `dataConfig.createQuery()` method, this is where all the `select`, `where`, `from`, etc clauses are filled in

Example of `ddfQuery`
```js
from: "datapoints"
language: "en"
select: {key: ["country", "time"], value: ["population_total"]}
where: {country.un_state: true, time: "2019"}
```

### ====== dataSource.js ======
—> `query(query)`  
Adapters: dot to join, add explicit and

```js
//dotToJoin converts
where: {country.un_state: true, time: "2019"}
//to
where: {time: "2019", country: "$country"}
join: {
  $country:{
    key: "country"
    where: {un_state: true}
  }
}

//addExplicitAnd converts
where: {country.un_state: true, time: "2019"}
//to
where: {
  $and: [{time: "2019"}, {country: "$country"}]
}
```
we can get rid of those by making readers and WS support the query in the form before adapters

—> `combineAndSendQueries(query)`   
If query already exists in cache, then returns it. Find out which queries can be combined (stringify all fields minus select.value) and if we already have a fitting query in the queue waiting to be sent to reader. If so, add an extra column to that query, otherwise create a new query in a queue and push it to cache.

—> `sendDelayedQuery(query)`   
Sleep one execution frame to let the queries be combined and send them to reader

—> `reader.read(query)`
```js
response //--> (195) [{…}, {…}, {…}, …]
0: {country: "afg", time: Tue Jan 01 2019 01:00:00 GMT+0100 (CEST), population_total: 38041757}
1: {country: "ago", time: Tue Jan 01 2019 01:00:00 GMT+0100 (CEST), population_total: 31825299}
2: {country: "alb", time: Tue Jan 01 2019 01:00:00 GMT+0100 (CEST), population_total: 2880913}
```
—> `normaliseResponse`  
Creates a DataFrame for a common space of encoding and marker (thus, normalisation): guarantees that each key resolves to one marker item.

Also, reader API is not completely stable, so we need to create a DF if it isn’t one already (DF is a map with extra functions, it creates an index on the key so it’s quicker to access)

The returned object is not a DF yet, but a function that can create a DF for a given key (space) later:

```js
response //→ {raw: Array(195), forKey: ƒ, forQueryKey: ƒ}
```

## Concept side quest
### ====== dataConfig.js ======
—> `get state()`   
—> `source.conceptsState()`

### ====== dataSource.js ======
—> `get conceptsState()`  
—> `get conceptsPromise()`  
—> `get fetchConcepts()`  
This waits for availability to be loaded in `fromPromise(this.availabilityPromise.then(...))`
—> `query(query)`

## Availability side quest
### ====== dataSource.js ======
—> `get fetchConcepts()`
—> `get availabilityPromise()`
—> `query(query)` 3 times


# Main quest continues: data comes from the reader
### ====== dataConfig.js ======
—> `get response()`
This is where the data comes back from responsePromise: see how `fetchResponse()` ends with `.then(response => response.forKey(this.commonSpace))` where `commonSpace` is the overlap between marker space and encoding space. This will trigger creation of a dataframe, so the output looks like this:

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


### ====== marker.js ======
—> `get state()`  
mentions-triggers `dataMapCache` or `dataMap` (which through transformations also leads to `dataMapCache`)  

—> `get dataMapCache()` 
Each encoding has its own response (which might come from the same combined query to a datasource and they might even be in the same dataframe if the key is the same). Marker model combines all encoding responses in its dataMapCache. The combination should result in a table of marker items. We have 2 types of encs: marker-defining, marker-amending and no-op encodings. Combination happens using fullJoin and leftJoin. Renaming (projection in database language) also happens while joining.

A third type of encoding are encodings that don’t do anythin (no-op), such as select and highlight, they don’t modify data. 

—> `get transformedDataMaps()`
After joining data from diffrent encodings the resulting Dataframe gets pulled through a series of transfomations.

Transformations can be defined on a marker level or on an encoding level (Some encodings need to do transformations on the data)
- Frame encoding wants to group, interpolate, extrapolate
- Order encoding wants to change order
- Trail encoding adds trails from previous frames
- Marker wants to filter marker items by required encodings, removing those that don't have data

The order of transformations is saved in a configurable array.  
Transformations can rerun partially, because they are run in boxed ccomputed and the result is saved  
How to use boxed computeds: `prevResult.get()` actually is what triggers the computation
Note how `get transformationFns()` distinguish between transformations of marker and encodings: if there is no dot, we look for the function on the marker, if there is we look for a function on encoding

—> `get datamap()`
Gets the result of the "final" step of transformations. Transformations are being run backwards: data is pulled, not pushed through transformations. The resulting datamap is a bunch of transformations that happened on datamapcache in a certain order.

—> `get dataArray()`
Data array is just dataMap in a form of array