
# ERROR HANDLING
An error is thrown like this:  
`throw new Error(“something failed”)`  

>(i think i proved this it wrong, should remove this paragraph)   
>Normally the error bubbles up in reactions. If error is within a computed and not in try-catch block, and you try to catch it outside of the computed, it will still be thrown before it's caught. But it can only be caught completely within a computed code. But we can handle it in reaction/autorun level


# Two ways to handle errors
There are couple of ways we can handle errors

## Global MobX error handler
```js
mobx.onReactionError((error, reaction) => console.warn(error, "in", reaction))
```
Nice because that would be a single error handler for all errors everywhere

But the global handler doesn’t prevent `[mobx]` error to crash

Global error is triggered for every reaction that broke

Global handler is a fallback when handling is not done in reaction-specific handlers

> Don’t set `disableErrorBoundaries`: reactions will then throw themselves and stop working (won’t recover)

## Local `onError` function in options of autorun/reaction
Passed along with the name

```js
mobx.autorun(fn, { 
    fn.name,
    onError: (err) => console.warn('hellooo, error in', fn.name, err) 
})
```
If reaction has its own `onError` handler it will not throw the error itself.

If reaction has its own `onError` handler it won’t use the global one (global acts as a fallback)

***

# Two types of errors
- Bugs in the code --> go around gracefully, report in rollbar  
- Wrong input during runtime: file not found, connection lost, etc --> show it to user with a helpful message

How to distinguish 1 from 2?

```js
class RuntimeError extends Error {
  name = RuntimeErrror
}
throw new RuntimeError(“message”)
```

# Every promise should re-throw error
Every promise should have a `catch` implementation, inside of which it should pass the error to the handler of outer `catch`... and eventually to the handler on component level (i.e. it should rethrow the error):

```js
path = "data.csv";
fetch(path)
  .then()
  .catch((error) => {
	  error.message = "file not found";
      error.details = path;
	  return error; //--> resolves a promise, don't use this
	  throw error; //--> rejects a promise, that's what we need
  })

```

[Example](https://github.com/vizabi/vizabi-ddfservice-reader/commit/7cbce0ba1dcdaf98b16b953c367f8302e1ba1731)

Every action/reaction/autorun should have a name for easier debugging and more helpful error messages.
