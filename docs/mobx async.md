# Async state in mobx

## Benefits of MobX for state management
Mobx allows you to define base state and derived, i.e. computed, state. 

```js
const foo = observable({ 
    x: 1,
    y: 3,
    get doubleX(): { return this.x * 2 },
    get tripleY(): { return this.y * 3 }
});
```

MobX enables side-effects of the state in two ways:
 - Input as `action`s: A function which changes base state. 
 - Output as `reaction`s: A function reacting to a change in either base or derived state.

```js
const setX = action(newX => foo.x = newX);
const disposer = reaction(() => foo.doubleX, dbl => console.log(dbl));
setX(5); // logs 10 through reaction
setX(2); // logs 4 through reaction
```

Derived state is only recomputed when relevant base state changes ánd it is directly or indirectly observed by a reaction. In the below example, `foo.tripleY` is never calculated. Above, `foo.doubleX` is calculated, because the reaction is observing it.

```js
const setY = action(newY => foo.y = newY);
setY(2); // No side effects or derived state calculation because foo.y is not observed (directly or through derived state) by a reaction
```

The moment base state changes and it is observed, mobx first recalculates any derived state in the correct order and only then reruns any reactions that are observing changed state. The amazing result is that your state is _always_ consistent when your code is running. Especially with complex state this abstracts away a great deal of logic.

## Async state
There are situations where derived state is calculated asynchronously. Think of a worker to offload the main thread or a network request which doesn't block the main thread.

Mobx documentation only discusses async actions and several utility functions for them. `mobx-task`  Using that, you could set up a `reaction` to send the request and an `action` to handle the response.

```js
const foo = observable({
    x: 4,
    doubleX: null,
    handleDoubleX: action(function(doubleX) { 
        this.doubleX = doubleX;
    });    
});

const disposer = reaction(
    () => foo.x, 
    x => fetch('example.com/api/double/' + x).then(r => r.text()).then(foo.handleDoubleX)
)
```

This breaks a lot of the beauty of MobX. Even though `foo.doubleX` is technically still state derived from `foo.x` we lose:
 - **State consistency**: doubleX now has the status of base state allowing for *inconsistent state*
    - Any action can change it to create inconsistent state, it is not explicitly linked to x anymore.
    - While the async computation is happening, the state is inconsistent. If `foo.x` is changed to 3, there is some time that `foo.doubleX` is not 6. Nothing prevents a view from using this inconsistent state.
    - Race conditions can now lead to inconsistent state. Updating `foo.x` twice in a row starts two api requests (e.g. `4` and `5`). If the first request returns after the second, you'll end up with `foo.doubleX = 8` from the last response and `foo.x = 5` from the last action. 
 - **Clarity of intention**: The way `foo.doubleX` is calculated is now moved to a separate reaction and not anymore part of the definition of `foo.doubleX`. The definition now shows it as base state.
 - **Efficiency of computed state**: `foo.doubleX` is calculated when `foo.x` changes, even when `foo.doubleX` is not observed by an actual reaction (i.e. one used for e.g. UI drawing, not async state computation).

## computed-async-mobx

The `computed-async-mobx` library solves most of these problems.

```js
const foo = observable({
    x: 2
    doubleX: promisedComputed(function () => {
        return fetch('example.com/api/double/' + this.x).then(r => r.text());
    })
});
```

It does introduce an inconsistent API as it requires you to use the `get()` method on computed to read its value. You can use its `busy` (observable) property to read its current status.

```js
const foo = observable({
    x: 2
    doubleX: promisedComputed(function() {
        return fetch('example.com/api/double/' + this.x).then(r => r.text());
    }),
    get doubleDoubleX() {
        return 2 * this.doubleX.get();
    },
    get loading() {
        return this.doubleX.busy;
    }
});
```

It solves the ineffiency and clarity problems and is not prone to race conditions. However, the problems it does not solve are:
 - **overwritable base value** the promisedComputed is in essence still base state and thus can be overwritten by any action. 
 - **inconsistent state while loading** While the async state is loading, `foo.x` is already updated while `foo.doubleX` isn't.

The API and base state issue can be solved by moving the promisedComputed outside the object or to a helper property. It's a tradeoff as it requires extra code and creates distance between the property and its defintion.

```js
const doubleXComp = promisedComputed(() => {
    return fetch('example.com/api/double/' + foo.x).then(r => r.text());
})
const foo = observable({
    x: 2,
    doubleXComp: promisedComputed(() => {
        return fetch('example.com/api/double/' + foo.x).then(r => r.text());
    }),
    get doubleX() {
        return (this.)doubleXComp.get();
    },
    get doubleDoubleX() {
        return 2 * this.doubleX;
    },
    get loading() {
        return (this).doubleXComp.busy;
    }
});
```

## mobxUtils.fromPromise

`mobxUtils.fromPromise` does almost the same as `computed-async-mobx`, except that you pass it a promise instead of a function and whenever pending, its value is `undefined`. 
You can fix this by passing an old mobx promise as the second argument or using its `case()` method to return an old value when pending, but this requires another helping variable.

```js
const oldPromise = {
    doubleX: null,
}

const asyncs = observable({
    get doubleX() {
        return oldPromise.doubleX = fromPromise(fetch('example.com/api/double/' + foo.x).then(r => r.text()), oldPromise.doubleX);
    }
});

const foo = observable({
    x: 2,
    get doubleX() {
        return asyncs.doubleXComp.value;
    },
    get doubleDoubleX() {
        return 2 * this.doubleX;
    },
    get loading() {
        return Object.values(asyncs).some(p => p.status === "pending");
    },
});
```

## Proposal 1 

If a MobX computed returns a promise, MobX will postpone updating the complete state, including state up the derivation tree (e.g. `foo.x`) until the promise is resolved. Once the promise is resolved, it will continue calculating derived state until all stale state is refreshed. This may include additional promises and related waiting. Only after all stale state is recalculated, base and (async) computed state will reflect their new values. This way state is always consistent.

Progress and error management is handled on the reaction level, either with an object or additional function arguments.

```js
autorun(alwaysRun);
autorun({ pending: pendingFunction, rejected: rejectedFunction, resolved: resolvedFunction });
autorun(resolvedFunction, pendingFunction, rejectedFunction);
```

## Proposal 2

Mobx does not wait until full state is recalculated with updating new values. It does still offer the same API for pending and rejected async state. In pending status, state will be inconsistent. It is advised that an interface draws a loading animation instead of the actual interface.

## Async atomic actions / 

Another way to name this is "async atomic actions". In the same way actions are atomic transactions you want async state change, triggered by base change to also be atomic.


```js
promisedComputeds = ['doubleX'];
pc = promisedComputed(function () => {
        return fetch('example.com/api/double/' + this.x).then(r => r.text());
});
const foo = observable({
    x: 2,
    get doubleX() { return pc.get() },
    get doubleDoubleX() {
        return 2 * this.doubleX;
    },
    get loading() {
        return promisedComputeds.some(p => p.busy);
    }
});
```