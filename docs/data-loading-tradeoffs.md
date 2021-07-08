# DATA LOADING TRADEOFFS

Vizabi sends out async requests to data sources whenever related state changes. It uses mobx to handle this reactive behaviour. However, there are different patterns to set this up, each with their own drawbacks.

Also see [this mobx github discussion](https://github.com/mobxjs/mobx/discussions/3007).

The API requirements (req 1-4) are:
 1. Async requests should be reactive. This means:
    1. They are lazy; They are only sent when a model is actively used, i.e. when its state is observed, not on model creation. I.e. State observation is necessary.
    2. They are sent when a model's state becomes observed, without additional code; I.e. State observation is sufficient.
    3. They are resent when any observable they use updates.
    4. Users and vizabi-core devs do not have to distuinguish async-related state from sync state. They can just write to the model config and observe the `state` prop.
 2. when a new request is sent out, the old request should be discarded/cancelled to prevent race conditions (an earlier request resolving after later request).
 3. the request should only be sent out after any actions have finished
 4. the request should be sent out before any external reactions are executed

# Computeds (the current way)
A `computed` named `promise` sends the async request and returns the `fromPromise()` of the request (req 1.3 and 2). The `state` observes `promise`, thus the moment `state` becomes observed `promise` sends the async request (req 1.1 and 1.2). The model's value and state are a computeds, returning `promise.value`, and `promise.state`, which always reflect the latest request (req 2).

As the request is in a `computed`, no reactions will be triggered before the request is sent out. Computeds will first fully resolve staleness before reactions are executed (req 4).

The drawback of `computed` is that recomputes can happen during an action, breaking the action-is-atomic-change principle. This can trigger async requests while the action is underway and thus send out wrong queries (e.g. old concept, new space). So it fails req 3.

This is the currently implemented async data loading pattern. The drawback can be worked around changing actions to dereference any needed async state before making changes to observables.

Example JS Fiddle: https://jsfiddle.net/jasperh/2h6f5dv3/4/. You could solve the bug in this specific example: make `sync2` a computed which contains the `if` statement and observes a different base state. Sure, but (1) it shows unexpected bugs come with this pattern and (2) this is just an example to show this pattern can trigger async loading during the action, which may be harder to avoid in more complex systems.

```js
const { observable, autorun, runInAction, trace, action } = mobx;
const { fromPromise } = mobxUtils;

const obs = observable({
  sync: 1,
  sync2: 2,
  get promise() { return this.fetchSmth() },
  get async() { return this.promise.value },
  get state() { return this.promise.state },
  fetchSmth: function() {
    console.log('fetching', this.sync, this.sync2);
    let promise = Promise.resolve(this.sync + this.sync2);
    return fromPromise(promise);
  }
})

autorun(
  () => obs.state == 'fulfilled' && console.log(obs.sync, obs.async), 
  { name: 'component' }
)

window.setTimeout(action(() => {
  obs.sync = 5;
  // triggers obs.promise recompute before sync is set
  // can be prevented by doing `const async = obs.async` before setting obs.sync
  if (obs.async == 3)
    obs.sync2 = 6;
}), 1000);
```

# Autorun & action
An autorun runs the async request when upstream state changes (req 1.3). It assigns the request's promise to a `promise` property on the model. The async value and state are a computeds, reading  `promise.value`, and `promise.state`, which always reflect the latest request (req 2).

Using `mobx.onBecomeObserved` and `mobx.onBecomeUnobserved` we only create the autorun when `promise` is observed (e.g. through `state`), and dispose of it when it's unobserved (req 1.1 and 1.2).

Since the async request is sent in a reaction, it will only fire after the related action is completely finished (req 3).

The drawback is that the autorun has no priority over other reactions (req 4). Mobx' reaction execution order is deterministic but opaque, not easily configurable and not part of the API and thus we cannot rely on it. This can mean that external reactions fire before the async request is done, leading to inconsistent state (e.g. new concept/space, loading state not yet "pending" and old async state).

Example JS Fiddle: https://jsfiddle.net/jasperh/8c7mbLsj/54. This does not reproduce the drawback of component autorun running before async request. When we tried implementing this pattern, we get this problem in Vizabi-data but we haven't been able to reproduce it in a JS Fiddle.

```js
const { observable, autorun, runInAction, action } = mobx;
const { fromPromise } = mobxUtils;

const obs = observable({
  sync: 1,
  promise: fromPromise(() => {}),
  get async() { return this.promise.value },
  get state() { return this.promise.state },
  fetchSmth: function() {
    let promise = Promise.resolve(this.sync + 1);
    runInAction(() => this.promise = fromPromise(promise));
  }
})

lazyAsync(obs, 'promise', obs.fetchSmth.bind(obs))

autorun(
  () => obs.state == 'fulfilled' && console.log(obs.sync, obs.async), 
  { name: 'component' }
)

window.setTimeout(action(() => obs.sync = 5), 1000);

function lazyAsync(obj, prop, fn) {
  let disposer;
  mobx.onBecomeObserved(obj, prop, () => {
    disposer = autorun(fn, { name: 'lazy' })
  })
  mobx.onBecomeUnobserved(obj, prop, () => {
    disposer();
  })
}
```

# Actions
This is a variation on how the [mobx docs recommend handling async data](https://mobx.js.org/actions.html#asynchronous-actions).

A promise property on the model holds the current promise. An action runs the async request and assigns its promise to the property (req 2). This action needs to be called "manually" after every state change that could trigger a new async request. `mobx.onBecomeObserved` makes sure it's also called when `state` starts being observed (req 1.1 & 1.2).

Calling the async request action inside any state-setting action ensures the request is done before any other reactions are triggered (req 4). And since it's explicitly called at the end of state-setting, it won't trigger by accident during the action (req 3).

A big downside is that you always need to call a specific action to update any async derived state. You can't just assign to concept, as that won't trigger the async request (fails req 1.3).

You can't set setters on all properties, each triggering the async load, as that would trigger load after each property change (fails req 3). Sometimes you want to trigger load after a couple of changes (e.g. concept, space and source). You can't use `mobx.observe` for the same reason.

Basically you lose most of the mobx reactive magic (req 1). You'll have to manually trigger async derived state changes. That can lead to bugs if the action is not called when it should be.

Example JS Fiddle: https://jsfiddle.net/jasperh/L84g52z1/

```js
const { observable, autorun, runInAction, trace, action } = mobx;
const { fromPromise } = mobxUtils;

const obs = observable({
  sync: 1,
  promise: fromPromise(() => {}),
  get async() { return this.promise.value },
  get state() { return this.promise.state },
  fetchSmth: action(function() {
    let promise = Promise.resolve(this.sync + 1);
    this.promise = fromPromise(promise);
  }),
  changeSync: action(function(newVal) {
    obs.sync = newVal;
    // have to do this on every state change that should trigger async request
    obs.fetchSmth(); 
  })
})

mobx.onBecomeObserved(obs, 'promise', obs.fetchSmth.bind(obs))

autorun(
  () => obs.state == 'fulfilled' && console.log(obs.sync, obs.async), 
  { name: 'component' }
)

window.setTimeout(() => obs.changeSync(5), 1000);
```


# Autorun & Action with state update after async response

This is basically the "Autorun & Action" pattern, but any sync base state gets set to a temporary object which is unavailable to external reactions. The async autorun has access and will run once the action is complete. Then, when the async request is complete, the temp object and the async response will together become available to the external reactions through the promise resolve value.

This will ensure that any external reactions only become stale after the async request is resolved, while the internal (autorun) reaction is already stale when setting the sync state, triggering the async request.

This is... a bit convoluted. And it requires that we keep track of what state is related to the async request and save that to the `asyncPrepare` object (fails 1.4). But it seems fulfill the requirements the best. Plus, in vizabi making the getter and setter for config values adds another layer and thus complexity to the config.


JS Fiddle: https://jsfiddle.net/jasperh/oy8bae1z/2/
```js
const obs = observable({
  get sync() { return this.promise.value.sync },
  set sync(val) { this.asyncPrepare.sync = val },
  promise: fromPromise(() => {}),
  asyncPrepare: {
  	sync: 1
  },
  get async() { return this.promise.value.async },
  get state() { return this.promise.state },
  fetchSmth: function() {
    let context = this.asyncPrepare;
    let promise = Promise.resolve(context.sync + 1)
    	.then(result => Object.assign({}, context, { async: result }));
  	runInAction(() => this.promise = fromPromise(promise));
  }
})

lazyAsync(obs, 'promise', obs.fetchSmth.bind(obs))

autorun(
  () => obs.state == 'fulfilled' && console.log(obs.sync, obs.async), 
  { name: 'component' }
)

window.setTimeout(action(() => obs.sync = 5), 1000);

function lazyAsync(obj, prop, fn) {
  let disposer;
  mobx.onBecomeObserved(obj, prop, () => {
    disposer = autorun(fn, { name: 'lazy' })
  })
  mobx.onBecomeUnobserved(obj, prop, () => {
    disposer();
  })
}
```

Here's another example using `mobxUtils.createViewModel`: https://jsfiddle.net/jasperh/2h6f5dv3/62/ . It still needs knowledge of which properties would trigger async, this time on the user-side (write to app or internal store).