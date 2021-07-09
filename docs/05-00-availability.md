
```js
//on tools page
viz.model.markers.bubble.availability
// -->(5611) [{…}, {…}, {…}, {…}, {…}, {…}, {…}, {…}, …]

viz.model.markers.bubble.availability[0]
//--> {key: ["concept"], source: Proxy {…}, value: {concept: "color", concept_type: "string", …}}

viz.model.markers.bubble.spaceAvailability 
//--> (59) [Array(1), Array(1), Array(1), Array(1), Array(1), ...]

viz.model.markers.bubble.spaceAvailability[15]
//--> (2) ["country", "time"]

```