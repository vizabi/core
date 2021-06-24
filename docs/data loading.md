# Mobx <-> Async requests interface

Vizabi sends out async requests to data sources whenever related state changes. It uses mobx to handle this reactive behaviour. However, there's different patterns to set this up, each with their own drawbacks.

The API requirements (req 1-6) are:
 1. async requests should be lazy: they are only sent when a model is actively used, i.e. its state is observed, not on model creation. I.e. State observation is necessary.
 2. async requests are sent the moment a model's state becomes observed; there's no need for additional API method calls. I.e. State observation is sufficient.
 3. async requests are sent whenever the query or source (or any other state influencing the async request) changes
 4. when a new request is sent out, the old request should be discarded/cancelled to prevent race conditions (an earlier request resolving after later request).
 5. the request should only be sent out after any actions have finished
 6. the request should be sent out before any external reactions are executed

## Computeds
The async request is done in a computed called `promise` which returns the `fromPromise()` of the request (req 3 and 4). The computed is observed by the model's `state` and the async request is thus sent the moment `state` becomes observed (req 1 and 2).

As the request is in a computed, no reactions will be triggered before request is sent out. Computeds will first fully resolve staleness before reactions are executed (req 6).

The drawback of computed is that recomputes can happen during an action, breaking the action-is-atomic-change principle. This can trigger async requests while the action is underway and thus send out wrong queries (e.g. old concept, new space). So it fails req 5.

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
  {	name: 'component' }
)

window.setTimeout(action(() => {
  obs.sync = 5;
  if (obs.async == 3)
  	obs.sync2 = 6;
}), 1000);
```

## Autorun & action
A promise property on the model holds the current promise. An autorun runs the async request on init and when upstream state changes (req 3). The autorun assigns the request's promise to the promise property. The async value and state are a computeds, reading  `promise.value`, and `promise.state` (req 4).

Using `mobx.onBecomeObserved` and `mobx.onBecomeUnobserved` we only create the autorun when `promise` is observed (e.g. through `state`), and dispose of it when it's unobserved (req 1 and 2).

Since the async request is sent in a reaction, it will only fire after the related action is completely finished (req 5).

Sadly, since the async request is in a reaction, it has no priority over other reactions (req 6). Mobx' reaction execution order is deterministic but opaque and not easily configurable and thus you should not rely on it. This can mean that external reactions fire before the async request is done, leading to inconsistent state (e.g. new concept/space, loading state not yet "pending" and old async state).

Example JS Fiddle: https://jsfiddle.net/jasperh/8c7mbLsj/54. This does not reproduce the drawback of component autorun running before async request. At the moment of writing this does happen in Vizabi-data but we haven't been able to reproduce in a JS Fiddle.

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
  {	name: 'component' }
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

## Actions
A promise property on the model holds the current promise. An action runs the async request and assigns its promise to the property (req 4). This action needs to be called "manually" after every state change (i.e. action) that could trigger a new async request. `mobx.onBecomeObserved` makes sure it's also called when `state` starts being observed (req 1 and 2).

Calling the async request action inside any state-setting action ensures the request is done before any other reactions are triggered (req 6). And since it's explicitly called at the end of state-setting, it won't trigger by accident during the action (req 5).

A big downside is that you always need to call a specific action to update any async derived state. You can't just assign to concept, as that won't trigger the async request. You can't set setters on all properties, each triggering the async load, as that would trigger load after each property change. Sometimes you want to trigger load after a couple of changes (e.g. concept, space and source). You can't use `mobx.observe` for the same reason.

Basically you lose the mobx reactive magic as you have to manually trigger async derived state changes. With a manual trigger you technically fulfill req 3, but we're losing reactivity. That can lead to bugs if the action is not called when it should be.
Also req 2 might not be fulfilled, as every action you write should contain this extra manual fetch-trigger.

Exampel JS Fiddle: https://jsfiddle.net/jasperh/L84g52z1/

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
  {	name: 'component' }
)

window.setTimeout(() => obs.changeSync(5), 1000);
```


## Autorun & Action with state update after async response

This is basically the "Autorun & Action" pattern, but any sync base state gets set to a temporary object which is unavailable to external reactions. The async autorun has access and will run once the action is complete. Then, when the async request is complete, the temp object and the async response will together become available to the external reactions through the promise resolve value.

This will ensure that any external reactions only become stale after the async request is resolved, while the internal (autorun) reaction is already stale when setting the sync state, triggering the async request.

This is... a bit convoluted. And it requires that we keep track of what state is related to the async request and save that to the `asyncPrepare` object. But it seems fulfill the requirements the best. Plus, in vizabi making the getter and setter for config values adds another layer and thus complexity to the config.


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
  {	name: 'component' }
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