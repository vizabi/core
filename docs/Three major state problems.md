# Three major state problems

 1. Dependent state changes. One state changing should reset another state to a default mode.
 1. Async computed state creates temporary inconsistent state
 2. State diffing, including dependent state (e.g. concept change => scale type change: scale type should not be in diffed state)

## 1. Dependent state changes

A change of state should automatically also (re)set other, dependent, state. This state to react to may be computed state.

For example, if `data.concept` changes, `scale.type` should reset to default (either data or model default). We do this by setting user config to null. You could do so as a reaction:

```js
reaction(() => encoding.data.concept, () => encoding.scale.config.type = null);
```
However, this means the change is not atomic. The scale type changes only after the concept (and any derived config) has updated and reactions are being triggered.
This can lead to data shortly being displayed on previous scale type if the graph drawing reaction is executed before the scale reset reaction. So, instead we could do this in the action which sets concept, which makes sure the type is reset atomically with the concept change.

```js
action(function setConcept(concept) { 
    this.data.concept = concept;
    this.scale.type = null;
});
```

Another case is scale domain: when new data comes in, we should always reset scale domain (i.e. reset zoom). Now, here we can also use a reaction, with the same downside of possibly causing flickering, depending on order of reactions. This should be avoided.

```js
reaction(() => encoding.data.response, () => encoding.scale.config.domain = null);
```

So, move it to the action, right? But we don't have an action setting data.response. `data.response` is an (async) computed property and depends on many base state properties which define the DDF query (`concept`, `space`, `filter`, `locale`, `source`). So, we should add scale reset on each action setting those base properties. This indirect link is not as clear as we'd like it. Domain scale is dependent on a new response, not necessarily on those base state properties (indirectly yes, but if we remove one of those base props from the DDFquery, they shouldn't reset scale domain anymore).

Other solutions are 
 - Traverse the MobX derivation tree to find the base properties `data.response` is computed from and dynamically add scale reset to their setting actions (`mobx.observe`?)
 - Have some way to add this dependency to `data.response` recomp to `scale.domain` computed prop code. Not sure how though.
 - Use `mobx.observe` to observe `data.response` and reset `scale.domain` on every update. 

The last solution seems most promising at this moment. A problem is that when an action first sets `scale.type` and then `data.concept`, the newly set `scale.type` will right away be reset. This is most likely an unwanted side effect of the `data.concept` setting at this point. This order mattering can lead to hard to find bugs.
The same problem even more exists with config changes leading to a new `data.response`, each one of them will reset any configured `scale.domain` that was configured at the same time (e.g. initial config). We can't even use the order of setting `scale.domain` and `data.response`, because `data.response` will *always* be set after setting `scale.domain` since `data.response` is set asynchronously, outside the original `action`.

So you'd want a way to change base state both with and without dependent (possibly async) changes.

## 2 Async computed creates inconsistency

For example, when `data.concept` changes, `scale.type` should be reset to default. We can do this using the `mobx.observe` method described above. However, that means that the new `scale.type` will be active, while the old `data.response` is still active. Preferably, you would want to only update `scale.type` once the async calculation of `data.response` is finished so that only the new data is shown on the updated scale. In other words, the action which changes data.concept should have async atomicity.

Solution, proposition 1 in [mobx async doc](mobx%20async.md) or don't promise consistency during loading.

## 3. State diffing given dependent state

State diffing, including dependent state (e.g. concept change => scale type change: scale type should not be in diffed state). 

Say the page config of an encoding is the following:

```js
{ 
    data: { concept: "gpd", space: ["geo","year"] },
    scale: { type: "log" }
}
```

Now the user changes concept to life expectancy, which makes the full config

```js
{
    data: { concept: "life_expectancy", space: ["geo","year"] },
    scale: { type: "linear" }
}
```

You want the url config to only show

```js
{
    data: { concept: "life_expectancy" }
}
```

Because the changed scale type is the default scale type for life expectancy. Just the `data.concept` is enough to recreate the old state.

Methods to achieve this:

```js
const initCfg = { encoding: { x: { 
    data: { concept: "gdp", space: ["geo","year"] }, 
    scale: { type: "log"}
}}};
const marker = Vizabi.marker(initCfg);
marker.encoding.x.setWhich({ value: "life_expectancy" })
const curCfg = marker.config; // gets current user config
Vizabi.config.diff(curCfg, initCfg);

```

Here curCfg is `{ data { concept: "life_expectancy", space: ["geo","year"]  } }` and the diff is `{ data { concept: "life_expectancy" } }`. If you'd merge curCfg with initCfg, which would happen when you get curCfg back from url, you'd get a faulty final config: 
```js
{ 
    data: { concept: "life_expectancy" }, 
    scale: { type: "log" } 
}
```

`scale.type` should not be `log`, instead it should be empty so that the default is applied. This is because a change in concept entails a reset to default of `scale.type` (and `scale.domain`). If the `mobx.observe` solution to the first problem is set, you could solve this problem by first setting initCfg and then `urlCfg`, which then resets any `scale.type/domain` from initCfg.

