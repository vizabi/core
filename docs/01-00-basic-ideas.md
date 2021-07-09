## Reactive programming
See autorun(), action() and reaction() from MobX

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
