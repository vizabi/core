# `vizabi-data`

`vizabi-data` offers an API which lets you define your data query in visualization terms such as markers, encodings, scales and data sources. It will then serve the data in tidy data format: one row per marker, one column per encoding.

Each data visualization consists of markers whose properties vary according to data encoded using a scale. For example, a circle (*marker*) changes radius (size *encoding*) according to population (*data*) following a square root scale (*scale*). See an example configuration below.

You can use reactive programming, powered by mobx, to always redraw your visualization when the data changes.

```js
const marker = Vizabi.marker({
    data: { 
        source: { reader: "csv", path: "data.csv" },
        space: ["geo", "gender", "year"]
    },
    encoding: {
        x: { data: { concept: "gdppcap" } },
        y: { data: { concept: "life_expectancy" } },
        size: { 
            data: { concept: "population" }, 
            scale: { type: "sqrt" } 
        },
        color: { data: { 
            space: ["geo"], 
            concept: "world_4region" 
        } },
        label: { data: { 
            modelType: "dimensionProperties",
            concept: "name"
        } },
        order: { data: { ref: "../size/data" } },
        frame: { data: { concept: "year" } }
    }
})

// use events
marker.on('dataArray', dataArray => {
    // draw using dataArray
});
// use observers from mobx
Vizabi.autorun(() => {
    // draw using marker.dataArray and any other observables
})
```

# References

You can refer to another part of the config using a `reference`. Just add `{ ref: "refPath" }` instead of the actual config. `refPath` can be absolute or relative, similar to filesystem paths. An absolute path consists of first the object type and then the object name, followed by the rest of the path. Thus, an absolute path can only reach named models as you need to specify which marker/encoding/data you're referring to.
```js
Vizabi.marker({ ... }, 'bubbles');
// ref: "markers/bubbles/encoding/size/data"

Vizabi.marker({ ... });
// not possible to reference with absolute path
// ref: "../trail/data/concept"
``` 

References to config or state? 

## Vizabi.marker()
```js
Vizabi.marker(config[, name]);
```
### marker config
```
{
    data: { ... }      /* Vizabi.dataConfig config or name */
    encoding: {
        enc1: { ... }  /* Vizabi.encoding config or name */
        ...                           "
        encN: { ... }                 "
    }        
}
```

## Vizabi.encoding()
```
Vizabi.encoding(config[, name]);
```

### encoding config
```
{
    data: { ... }      /* Vizabi.dataConfig config or name */
    scale: { ... }     /* Vizabi.scale config or name */
}
```

## Vizabi.scale()
```
Vizabi.scale(config[, name]);
```

### scale config
```
{
    type: "linear"      /* string: scale type id (string) */
    domain: [min,max]   /* scale domain (2 entry array) */
    range: [min,max]    /* scale range (2 entry array) */
}
```


## Vizabi.dataConfig()
```
Vizabi.dataConfig(config[, name]);
```

### dataConfig config
```
{
    source: "world_bank"            /* Vizabi.dataSource config or name */
    space: ["geo","gender","year"], /* array of dimension concept id strings */
    concept: "life_expectancy",     /* concept id string */
    locale: "ru-RU",                /* locale ID for data */
    constant: 85                    /* constant value instead of data */

}
```

## Vizabi.dataSource()
```
Vizabi.dataSource(config[, name]);
```

### dataSource config
```
{
    reader: "ddfcsv"     /* reader name */
    readerParam1: ""     /* reader dependent config */
    readerParamN: ""     /* reader dependent config */
}
```
