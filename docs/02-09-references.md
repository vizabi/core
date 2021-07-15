# REFERENCES

References are ways to link different parts of the model to each other. 

# Usage
## 1. Direct reference to an existing model

Reusing a model in the model tree at another location. All state is shared. This doesn't work when the model's state is/can be dependent on its place in the tree. For example an encoding's data source is dependent on its marker's data source.

E.g. dataSource models don't have any reference to parents and thus can be referenced directly. Moreover, there should be only one data source model for a source, so there is one cache go through only one model per data. 

Idea: This is not the case if we have a singleton cache and query joining object in which cache keys include data source (path/dataset). In that case we may even not need any direct references in Vizabi reactive.  `dataSource`s can then be separate models sharing one config.

```json
data: { 
	source: {
        ref: { path: "dataSource.gap" }
	}
}
```

## 2. New model from model

New model whose config depends on another model's values. This means the new model will have values dependent on the original model's derived state (derived from user config, parent models and/or data).

The new model's config is observing the referenced model and will thus react to changes in said model.

E.g. color legend data filter depends on bubble color domain. Not scale config domain (as that is user given), but actual domain as used in the visualization. In this example, a transform is also necessary to get the correct config for the new model.

```json
bubble: {
    data: { ... },
    encoding: { color: { 
        data: { space: ["country"], concept: "world_4region" },
        scale: { domain: ["europe", "asia"]} // could also be data driven
    }}
},
colorlegend: { 
    data: { 
        ref: { 
            transform: "entityConcept", 
            path: "marker.bubble.encoding.color" 
        }
    }
}
```

Above reference config, after transform, results in (if `color.data.concept` is an entity concept)

```json
colorlegend: {
    data: {
        space: ["world_4region"],
        filter: {
            world_4region: { $in: ["europe", "asia" ] }
        }
    }
}
```

## 3. New model from config

New model whose config depends on other model's config. This makes the new model only be dependent on specifically user configuration. Any other properties will be derived in the usual way (generally from data or parent state). 

The new model's config is observing the referenced config and will thus change react to changes in said config.

E.g. two bubble markers with different data sources share encoding configuration. Each encoding config has no data source and thus each encoding will use its own marker data source.

```json
un {
    data: { source: "un", space: ["country","year"] },
    encoding: {
		x: { ref: { config: "marker.wb.encoding.x" } },
		y: { ref: { config: "marker.wb.encoding.y" } }
	}
},
wb: { 
    data: { source: "wb", space: ["nation", "time"] },
    encoding: {
		x: { data: { concept: "gdppcap" } },
		y: { data: { concept: "lifeexp" } }
	}
}
```

Or you can use the shorthand:

```json
x: { ref: "marker.wb.encoding.x" },
y: { ref: "marker.wb.encoding.y" }
```

## Transforms
### `entityConcept` and `entityConceptSkipFilter`
Transforms are only used for legend marker at the moment: getting color encoding and making a dataConfig out of it. `space` of legend should be linked to the `concept` of encoding (but if enc is constant or not an entity concept, then space is empty). `entityConceptSkipFilter` variant is needed because otherwise legend will also link the filter and miss some entries if main marker doesn't have data for them. E.g. Asian part of the minimap would not draw when main marker filter excludes Asia. See example 2 above, we don't want the filter in colorLegend.

