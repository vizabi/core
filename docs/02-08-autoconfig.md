# AUTOCONFIG

Autoconfig sets concepts and spaces of encodings and spaces of markers when they aren't provided by the user.

This is useful when we want to read a new dataset right away without pre-configuring anything that depends on data. For example, this config would be enough to start a bubble chart:

```json
markers: {
  bubble: {
    data: {
      "modelType": "csv",
      "path": "data.csv"
    }
  }
}
```

Autoconfig is also useful when we switch something during runtieme. For example we switch space of the marker, now and all the encodings need to update their concepts and possibly own spaces to be compatible with the new marker space.

# Format of the output
`dataConfig.configSolution`

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

# Autoconfig flow
Follow the call stack in a diagram

![autoconfig call stack](https://user-images.githubusercontent.com/3648190/125870415-7befd14a-ad84-4031-94ad-75c88f3c7d6d.png)

# Custom methods
dataConfig models, encodings and markers can add methods

- solveMethod
how to filter concepts in availability and get valid candidate concepts for a given space

## Default method `defaultConceptSolver`
Apply the filter that is set by `dataConfig.config.concept` being set to an object

```json
concept: { filter: { concept: { "$eq": "y" } }}
```

### Special case `mostCommonDimensionProperty`
Used in entityPropertyDataConfig (dc of labels encoding). Takes all properties of all dimensions (entitity sets) in a given space, pushes them into an array then gets the mode of that array, i.e. most common value. `entityPropertyDataConfig` additionally restricts `allowedProperties` to be either "name" or "title".

- selectMethod
how to select concept for a given space from candidate concepts

### Special case frame encoding
Frame has a custom select method. Instead of selecting an unused concept it selects a frame concept: gives preference to concepts in space that are of type time and measure. If there is no time or measure in space then checks candidate concepts given by solveMethod. If notheing there either, then picks the last dimension of the space. It woud fail bad if space is an empty array.

- spaceSortingMethod (TODO)
### Default way: smallest space preferred, excluding 1-dim spaces
1-dim spaces go in back of the list, others: smallest spaces first

### Most popular space can be used: the one that has most concepts in it
TODO (not inplemented)

# How to prevent autoconfig 
## By config
Setting values for space and concept explicitly

## In certain encodings, such as select, highilght, repeat:
Set this in encoding 
```js
const defaultConfig = {data: {concept: undefined, space: undefined}}
```
then `needsSpaceAutoCfg` and `needsConceptAutoCfg` in configSolver.js will know they should resolve to false




