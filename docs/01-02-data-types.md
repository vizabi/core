# Models

## Marker

## Encoding

## Scale

## DataConfig

## Filter

## DataSource

# Others types

## Locale: String

## Query: Object

## DataFrame: Map<String => MarkerItemData>

## Availability

## spaceAvailability

## dataMap: Map<String => MarkerItemData>

## dataArray: Array<MarkerItemData>
see MarkerItemData

## MarkerItemData a.k.a. d: Object
should contain symbol for key
properties named as encodings

## d: Object
see MarkerItemData

## state: String
enumerates 3 possible values: "fulfilled", "pending", "rejected"



## kv

## space: Array<String>
an array of dimension keys, such as `["country", "time"]`



## dataConfig.allow

## scale.allowedTypes: Array<String>
```js
["linear", "log", "genericLog", "pow", "time"]
```

## reference: String | Object
```js
concept: { ref: "markers.bubble.encoding.color.data.concept" }
```

```
data: {
  ref: {
    transform: "entityConceptSkipFilter",
    path: "markers.bubble.encoding.color"
  }
}
```

## spaceCatalog: Promise
Used to build the "Show" dialog on tools page

```js
viz.model.markers.bubble.data.spaceCatalog.then(console.log)

country: {
  concept: {concept: "country", concept_type: "entity_set", description: null, …},
  
  entities: Map(195) {"afg" => {…}, "ago" => {…}, "alb" => {…}, "and" => {…}, "are" => {…}, …}
    //each map value: {country: "afg", name: "Afghanistan", Symbol(key): "afg"}
  
  properties: {
    g77_and_oecd_countries: {
      concept: {concept: "g77_and_oecd_countries", concept_type: "entity_set", description: null, …}
      entities: Map(3) {"g77" => {…}, "oecd" => {…}, "others" => {…}, …}
        //each map value: {g77_and_oecd_countries: "g77", name: "G77", rank: 1, Symbol(key): "g77"}
    },
    income_3groups: {concept: {…}, entities: Map(3)},
    income_groups: {concept: {…}, entities: Map(4)},
    
    ...
    
    is--country: {
      concept: {concept: "is--country", name: "is--country"}
    },
    latitude: {
      concept: {concept: "latitude", concept_type: "measure", description: null, …}
    },
    name: {
      concept: {concept: "name", concept_type: "string", description: null, …}
    },
    un_state: {
      concept: {concept: "un_state", concept_type: "boolean", description: null, …}
    },
    world_4region: {concept: {…}, entities: Map(4)}
    ...
  }
},

time: {
  concept: {concept: "time", concept_type: "time", description: null, …}
}
```


## configSolution: Object
```js
marker: {
  data: {
    configSolution: {
      space: ["geo", "time"],
      encodings: {
        x: {space: ["geo", "time"], concept: "gdp"}
        y: {space: ["geo", "time"], concept: "lex"}
      }
    }
  },
  encoding: {
    x: {
      data: {
        configSolution: {
          space: ["geo", "time"], concept: "gdp"
        }
      }
    }
  }
}
```