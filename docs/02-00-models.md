
# MODELS

# Model vs Model Config

Config is what you write to, model is what you read from.

To configure properties, write to the corresponding `.config` property. E.g. to configure `data.concept` assign `data.config.concept = "population"`. Directly writing to properties is not possible, to make clear that a written value can differ from what you will read afterwards, due to processing of the configured value. E.g. a configured scale domain that gets changed due to `clampDomainToData: true`.

To configure Marker, Encoding, DataConfig, Scale and Filter objects themselves, write a plain object with their config. E.g. `marker.config.data = { space: ['geo','year'], filter: {} }`

Config properties are a subset of model properties. So every config property is available on the model, albeit processed. On top of that, most models will have more properties depending on their features.  

For example, a marker model and marker config both have a `data` property. `marker.config.data` is just an object but `marker.data` is a full `DataConfig` model, built based on the `marker.config.data`. You can read from the `DataConfig` model (`marker.data`) and you can change the model by writing to the config (`marker.data.config` or `marker.config.data`).  



# Hierarchy of models
```
Marker-1 -> DataConfig-1 -> DataSource-1
        \-> Encoding-1   -> DataConfig-2 -> DataSource-1
        \-> Encoding-2   -> DataConfig-3 -> DataSource-2

Marker-2 -> DataConfig-4 -> DataSource-2
        \-> Encoding-3   -> DataConfig-5 -> DataSource-1
        \-> Encoding-4   -> DataConfig-6 -> DataSource-2
        \-> Encoding-5   -> DataConfig-6

```

- Each Marker has 1 DataConfig
- Each Marker has 1 or more Encodings
- Each Encoding has 1 DataConfig
- Each DataConfig has 0 or 1 DataSources

Reversely:

- Each DataSource is used in 1 or more DataConfigs
- Each DataConfig is used in 1 Encoding or Marker
- Each Encoding is used in 1 Marker

## DataSource models have shared config and model state

Each actual source has one config and one DataSource model with that config. A DataSource model has internal state for caches and query queues which is not reflected in the config. All DataConfigs that want to use the source use this one DataSource model. That way they can use eachothers cache and queries in the queue from different DataConfigs can be combined.

One config (describing a source) is only used by one model. That model is then used by many DataConfigs.

## Marker, Encoding, DataConfig models have shared config, separate model (state)

Marker, Encoding and DataConfig can have the same config used in multiple models. For example two marker encodings sharing a color encoding config. This means that changes in one model('s config) automatically apply to the other model. 

Each of these models' internal state describes its location in the hierarchy, through e.g. a parent property. This is used to use traverse for e.g. fallbacks from encoding dataconfig to marker dataconfig and solving autoconfiguration. Thus, we cannot have the same model on multiple places in the hierarchy.

So, one config can be used by many models. That model is then only used in one place in the hierarchy.

Autoconfiguring two models with a shared config is not yet implemented. Each model may end up solving to a different config value, since autoconfig is done in the model, and those are separate.






