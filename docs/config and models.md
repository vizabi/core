# Config and Model

Config is what you write to, model is what you read from. Config properties are a subset of model properties. So every config property is available on the model, albeit processed. On top of that, most models will have more properties depending on their features.

## Hierarchy of models
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
- Each DataConfig is used in 1 Encoding
- Each Encoding is used in 1 Marker

## DataSource: shared config and model state

DataSource is a wrapper around a vizabi reader. It broadens the API and adds features like response caching and nested availability.

Each actual source has one config and one DataSource model with that config. A DataSource model has internal state for caches and query queues which is not reflected in the config. All DataConfigs that want to use the source use this one DataSource model. That way they can use eachothers cache and queries in the queue from different DataConfigs can be combined.

One config (describing a source) is only used by one model. That model is then used by many DataConfigs.

## Marker, Encoding, DataConfig: shared config, separate model (state)

Marker, Encoding and DataConfig can have the same config used in multiple models. For example two marker encodings sharing a color encoding config. This means that changes in one model('s config) automatically apply to the other model. 

Each of these models' internal state describes its location in the hierarchy, through e.g. a parent property. This is used to use traverse for e.g. fallbacks from encoding dataconfig to marker dataconfig and solving autoconfiguration. Thus, we cannot have the same model on multiple places in the hierarchy.

So, ine config can be used by many models. That model is then only used in one place in the hierarchy.

Autoconfiguring two models with a shared config is not yet implemented. Each model may end up solving to a different config value, since autoconfig is done in the model, and those are separate.