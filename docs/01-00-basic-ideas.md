## Dimension, space, measure, concept...
to be described

## Reactive programming (user and developer of vizabi core needs to know)
See autorun(), action() and reaction() from MobX

## Extra things a developer of vizabi core needs to know
[fromPromise()](https://github.com/mobxjs/mobx-utils#frompromise) from MobX-utils
MobX struct comparison
boxed computeds and observables
utils.assign Object.defineProperty, Object.defineProperties

## MobX Proxies
All vizabi models are MobX proxies. When it’s hard to see anything inside, use `mobx.toJS()` (tools page has a shorter alias function `js()` for convenience)

```js
//on https://www.gapminder.org/tools/ open JS console and try:

viz.model.markers.bubble.encoding.y.config
//--> Proxy {Symbol(mobx administration): e}

mobx.toJS(viz.model.markers.bubble.encoding.y.config)
//--> {data: {…}, scale: {…}}

js(viz.model.markers.bubble.encoding.y.config)
//--> {data: {…}, scale: {…}}
```

## Maker-defining and marker-ammending encodings
- Defining encodings are those that create marker items (superspace encoding that's iterable). Definign encodings are not related with required encodings.
- Amending encs are those that don't (proper subspaces, constants, labels, concepts that are in the marker space)

## Required encodings
If a marker item doesn't have data from any of the required encodings it will be removed from marker dataArray. This makes bubbles disappear when data is missing for X or Y or size, but remain if data is missing for color.