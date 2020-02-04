// http://vizabi.org v1.0.1 Copyright 2019 undefined
(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory(require('mobx')) :
  typeof define === 'function' && define.amd ? define(['mobx'], factory) :
  (global = global || self, global.Vizabi = factory(global.mobx));
}(this, (function (mobx) { 'use strict';

  function fail$1(message) {
      throw new Error("[mobx-utils] " + message);
  }
  function invariant(cond, message) {
      if (message === void 0) { message = "Illegal state"; }
      if (!cond)
          fail$1(message);
  }
  var deepFields = function (x) {
      return (x &&
          x !== Object.prototype &&
          Object.getOwnPropertyNames(x).concat(deepFields(Object.getPrototypeOf(x)) || []));
  };
  var distinctDeepFields = function (x) {
      var deepFieldsIndistinct = deepFields(x);
      var deepFieldsDistinct = deepFieldsIndistinct.filter(function (item, index) { return deepFieldsIndistinct.indexOf(item) === index; });
      return deepFieldsDistinct;
  };
  var getAllMethodsAndProperties = function (x) {
      return distinctDeepFields(x).filter(function (name) { return name !== "constructor" && !~name.indexOf("__"); });
  };

  var PENDING = "pending";
  var FULFILLED = "fulfilled";
  var REJECTED = "rejected";
  function caseImpl(handlers) {
      switch (this.state) {
          case PENDING:
              return handlers.pending && handlers.pending(this.value);
          case REJECTED:
              return handlers.rejected && handlers.rejected(this.value);
          case FULFILLED:
              return handlers.fulfilled ? handlers.fulfilled(this.value) : this.value;
      }
  }
  function createObservablePromise(origPromise, oldPromise) {
      invariant(arguments.length <= 2, "fromPromise expects up to two arguments");
      invariant(typeof origPromise === "function" ||
          (typeof origPromise === "object" &&
              origPromise &&
              typeof origPromise.then === "function"), "Please pass a promise or function to fromPromise");
      if (origPromise.isPromiseBasedObservable === true)
          return origPromise;
      if (typeof origPromise === "function") {
          // If it is a (reject, resolve function, wrap it)
          origPromise = new Promise(origPromise);
      }
      var promise = origPromise;
      origPromise.then(mobx.action("observableFromPromise-resolve", function (value) {
          promise.value = value;
          promise.state = FULFILLED;
      }), mobx.action("observableFromPromise-reject", function (reason) {
          promise.value = reason;
          promise.state = REJECTED;
      }));
      promise.isPromiseBasedObservable = true;
      promise.case = caseImpl;
      var oldData = oldPromise && oldPromise.state === FULFILLED ? oldPromise.value : undefined;
      mobx.extendObservable(promise, {
          value: oldData,
          state: PENDING
      }, {}, { deep: false });
      return promise;
  }
  /**
   * `fromPromise` takes a Promise, extends it with 2 observable properties that track
   * the status of the promise and returns it. The returned object has the following observable properties:
   *  - `value`: either the initial value, the value the Promise resolved to, or the value the Promise was rejected with. use `.state` if you need to be able to tell the difference.
   *  - `state`: one of `"pending"`, `"fulfilled"` or `"rejected"`
   *
   * And the following methods:
   * - `case({fulfilled, rejected, pending})`: maps over the result using the provided handlers, or returns `undefined` if a handler isn't available for the current promise state.
   * - `then((value: TValue) => TResult1 | PromiseLike<TResult1>, [(rejectReason: any) => any])`: chains additional handlers to the provided promise.
   *
   * The returned object implements `PromiseLike<TValue>`, so you can chain additional `Promise` handlers using `then`. You may also use it with `await` in `async` functions.
   *
   * Note that the status strings are available as constants:
   * `mobxUtils.PENDING`, `mobxUtils.REJECTED`, `mobxUtil.FULFILLED`
   *
   * fromPromise takes an optional second argument, a previously created `fromPromise` based observable.
   * This is useful to replace one promise based observable with another, without going back to an intermediate
   * "pending" promise state while fetching data. For example:
   *
   * @example
   * \@observer
   * class SearchResults extends React.Component {
   *   \@observable searchResults
   *
   *   componentDidUpdate(nextProps) {
   *     if (nextProps.query !== this.props.query)
   *       this.comments = fromPromise(
   *         window.fetch("/search?q=" + nextProps.query),
   *         // by passing, we won't render a pending state if we had a successful search query before
   *         // rather, we will keep showing the previous search results, until the new promise resolves (or rejects)
   *         this.searchResults
   *       )
   *   }
   *
   *   render() {
   *     return this.searchResults.case({
   *        pending: (staleValue) => {
   *          return staleValue || "searching" // <- value might set to previous results while the promise is still pending
   *        },
   *        fulfilled: (value) => {
   *          return value // the fresh results
   *        },
   *        rejected: (error) => {
   *          return "Oops: " + error
   *        }
   *     })
   *   }
   * }
   *
   * Observable promises can be created immediately in a certain state using
   * `fromPromise.reject(reason)` or `fromPromise.resolve(value?)`.
   * The main advantage of `fromPromise.resolve(value)` over `fromPromise(Promise.resolve(value))` is that the first _synchronously_ starts in the desired state.
   *
   * It is possible to directly create a promise using a resolve, reject function:
   * `fromPromise((resolve, reject) => setTimeout(() => resolve(true), 1000))`
   *
   * @example
   * const fetchResult = fromPromise(fetch("http://someurl"))
   *
   * // combine with when..
   * when(
   *   () => fetchResult.state !== "pending",
   *   () => {
   *     console.log("Got ", fetchResult.value)
   *   }
   * )
   *
   * // or a mobx-react component..
   * const myComponent = observer(({ fetchResult }) => {
   *   switch(fetchResult.state) {
   *      case "pending": return <div>Loading...</div>
   *      case "rejected": return <div>Ooops... {fetchResult.value}</div>
   *      case "fulfilled": return <div>Gotcha: {fetchResult.value}</div>
   *   }
   * })
   *
   * // or using the case method instead of switch:
   *
   * const myComponent = observer(({ fetchResult }) =>
   *   fetchResult.case({
   *     pending:   () => <div>Loading...</div>,
   *     rejected:  error => <div>Ooops.. {error}</div>,
   *     fulfilled: value => <div>Gotcha: {value}</div>,
   *   }))
   *
   * // chain additional handler(s) to the resolve/reject:
   *
   * fetchResult.then(
   *   (result) =>  doSomeTransformation(result),
   *   (rejectReason) => console.error('fetchResult was rejected, reason: ' + rejectReason)
   * ).then(
   *   (transformedResult) => console.log('transformed fetchResult: ' + transformedResult)
   * )
   *
   * @param {IThenable<T>} promise The promise which will be observed
   * @param {IThenable<T>} oldPromise? The promise which will be observed
   * @returns {IPromiseBasedObservable<T>}
   */
  var fromPromise = createObservablePromise;
  fromPromise.reject = mobx.action("fromPromise.reject", function (reason) {
      var p = fromPromise(Promise.reject(reason));
      p.state = REJECTED;
      p.value = reason;
      return p;
  });
  fromPromise.resolve = mobx.action("fromPromise.resolve", function (value) {
      if (value === void 0) { value = undefined; }
      var p = fromPromise(Promise.resolve(value));
      p.state = FULFILLED;
      p.value = value;
      return p;
  });

  var __decorate =  function (decorators, target, key, desc) {
      var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
      if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
      else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
      return c > 3 && r && Object.defineProperty(target, key, r), r;
  };
  var StreamListener = /** @class */ (function () {
      function StreamListener(observable$$1, initialValue) {
          var _this = this;
          this.current = undefined;
          mobx.runInAction(function () {
              _this.current = initialValue;
              _this.subscription = observable$$1.subscribe(_this);
          });
      }
      StreamListener.prototype.dispose = function () {
          if (this.subscription) {
              this.subscription.unsubscribe();
          }
      };
      StreamListener.prototype.next = function (value) {
          this.current = value;
      };
      StreamListener.prototype.complete = function () {
          this.dispose();
      };
      StreamListener.prototype.error = function (value) {
          this.current = value;
          this.dispose();
      };
      __decorate([
          mobx.observable.ref
      ], StreamListener.prototype, "current", void 0);
      __decorate([
          mobx.action.bound
      ], StreamListener.prototype, "next", null);
      __decorate([
          mobx.action.bound
      ], StreamListener.prototype, "complete", null);
      __decorate([
          mobx.action.bound
      ], StreamListener.prototype, "error", null);
      return StreamListener;
  }());

  var __assign =  function () {
      __assign = Object.assign || function(t) {
          for (var s, i = 1, n = arguments.length; i < n; i++) {
              s = arguments[i];
              for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                  t[p] = s[p];
          }
          return t;
      };
      return __assign.apply(this, arguments);
  };
  var __decorate$1 =  function (decorators, target, key, desc) {
      var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
      if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
      else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
      return c > 3 && r && Object.defineProperty(target, key, r), r;
  };
  var RESERVED_NAMES = ["model", "reset", "submit", "isDirty", "isPropertyDirty", "resetProperty"];
  var ViewModel = /** @class */ (function () {
      function ViewModel(model) {
          var _this = this;
          this.model = model;
          this.localValues = mobx.observable.map({});
          this.localComputedValues = mobx.observable.map({});
          this.isPropertyDirty = function (key) {
              return _this.localValues.has(key);
          };
          invariant(mobx.isObservableObject(model), "createViewModel expects an observable object");
          // use this helper as Object.getOwnPropertyNames doesn't return getters
          getAllMethodsAndProperties(model).forEach(function (key) {
              if (key === mobx.$mobx || key === "__mobxDidRunLazyInitializers") {
                  return;
              }
              invariant(RESERVED_NAMES.indexOf(key) === -1, "The propertyname " + key + " is reserved and cannot be used with viewModels");
              if (mobx.isComputedProp(model, key)) {
                  var derivation = mobx._getAdministration(model, key).derivation; // Fixme: there is no clear api to get the derivation
                  _this.localComputedValues.set(key, mobx.computed(derivation.bind(_this)));
              }
              var descriptor = Object.getOwnPropertyDescriptor(model, key);
              var additionalDescriptor = descriptor ? { enumerable: descriptor.enumerable } : {};
              Object.defineProperty(_this, key, __assign(__assign({}, additionalDescriptor), { configurable: true, get: function () {
                      if (mobx.isComputedProp(model, key))
                          return _this.localComputedValues.get(key).get();
                      if (_this.isPropertyDirty(key))
                          return _this.localValues.get(key);
                      else
                          return _this.model[key];
                  }, set: mobx.action(function (value) {
                      if (value !== _this.model[key]) {
                          _this.localValues.set(key, value);
                      }
                      else {
                          _this.localValues.delete(key);
                      }
                  }) }));
          });
      }
      Object.defineProperty(ViewModel.prototype, "isDirty", {
          get: function () {
              return this.localValues.size > 0;
          },
          enumerable: true,
          configurable: true
      });
      Object.defineProperty(ViewModel.prototype, "changedValues", {
          get: function () {
              return this.localValues.toJS();
          },
          enumerable: true,
          configurable: true
      });
      ViewModel.prototype.submit = function () {
          var _this = this;
          mobx.keys(this.localValues).forEach(function (key) {
              var source = _this.localValues.get(key);
              var destination = _this.model[key];
              if (mobx.isObservableArray(destination)) {
                  destination.replace(source);
              }
              else if (mobx.isObservableMap(destination)) {
                  destination.clear();
                  destination.merge(source);
              }
              else if (!mobx.isComputed(source)) {
                  _this.model[key] = source;
              }
          });
          this.localValues.clear();
      };
      ViewModel.prototype.reset = function () {
          this.localValues.clear();
      };
      ViewModel.prototype.resetProperty = function (key) {
          this.localValues.delete(key);
      };
      __decorate$1([
          mobx.computed
      ], ViewModel.prototype, "isDirty", null);
      __decorate$1([
          mobx.computed
      ], ViewModel.prototype, "changedValues", null);
      __decorate$1([
          mobx.action.bound
      ], ViewModel.prototype, "submit", null);
      __decorate$1([
          mobx.action.bound
      ], ViewModel.prototype, "reset", null);
      __decorate$1([
          mobx.action.bound
      ], ViewModel.prototype, "resetProperty", null);
      return ViewModel;
  }());

  const isNumeric = (n) => !isNaN(n) && isFinite(n);

  function isString$1(value) {
      return typeof value == 'string';
  }

  function isEntityConcept(concept) {
      return ["entity_set", "entity_domain"].includes(concept.concept_type);
  }

  function mapToObj(map) {
      const obj = {};
      map.forEach((v, k) => { obj[k] = v; });
      return obj;
  }

  // intersect of two arrays (representing sets)
  // i.e. everything in A which is also in B
  function intersect(a, b) {
      return a.filter(e => b.includes(e));
  }

  /**
   * Is A a proper subset of B
   * Every A is in B, but A != B
   * @param {*} a 
   * @param {*} b 
   */
  function isProperSubset(a, b) {
      const intersection = intersect(a,b);
      return intersection.length == a.length && intersection.length != b.length;
  }

  /**
   * Relative complement (difference, B\A) of A with respect to B
   * Everything in B which is not in A. A=[geo,year], B=[geo,year,gender], B\A = [gender]
   * @param {*} a array representing set A
   * @param {*} b array representing set B
   */
  function relativeComplement(a, b) {
      return b.filter(e => !a.includes(e));
  }

  // returns true if a and b are identical, regardless of order (i.e. like sets)
  function arrayEquals(a, b) {
      const overlap = intersect(a, b);
      return overlap.length == a.length && overlap.length == b.length;
  }

  // copies properties using property descriptors so accessors (and other meta-properties) get correctly copied
  // https://www.webreflection.co.uk/blog/2015/10/06/how-to-copy-objects-in-javascript
  // rewrote for clarity and make sources overwrite target (mimic Object.assign)
  function assign(target, ...sources) {
      sources.forEach(source => {
          Object.keys(source).forEach(property => {
              Object.defineProperty(target, property, Object.getOwnPropertyDescriptor(source, property));
          });
      });
      return target;
  }
  function composeObj(...parts) {
      return assign({}, ...parts);
  }

  function ucFirst(string) {
      return string.charAt(0).toUpperCase() + string.slice(1);
  }

  // gets a getter accessor from an object and binds it to the object
  // used to overload methods when decorating objects
  function getBoundGetter(obj, prop) {
      return Object.getOwnPropertyDescriptor(obj, prop).get.bind(obj);
  }

  function moveProperty(oldObj, oldProp, newObj, newProp) {
      Object.defineProperty(newObj, newProp, Object.getOwnPropertyDescriptor(oldObj, oldProp));
  }
  function renameProperty(obj, oldProp, newProp) {
      moveProperty(obj, oldProp, obj, newProp);
  }

  function fromPromiseAll(promiseArray) {
      if (promiseArray.every(p.state == "fulfilled"))
          return fromPromise.resolve(promiseArray);
      if (promiseArray.some(p => p.state == "rejected"))
          return fromPromise.reject(promiseArray);
  }

  function defaultDecorator({ base, defaultConfig = {}, functions = {} }) {
      if (Array.isArray(functions)) functions = assign({}, ...functions);
      const newType = function decorate(config, parent) {
          applyDefaults(config, defaultConfig);
          delete functions.config;
          base = (base == null) ? (config, parent) => ({ config, parent }) : base;
          return assign(base(config, parent), functions);
      };
      newType.decorate = base.decorate;
      return newType;
  }

  function combineStates(states) {
      if (states.some(state => state === "rejected")) return "rejected";
      if (states.every(state => state === "fulfilled")) return "fulfilled";
      return "pending";
  }

  // code from https://github.com/TehShrike/is-mergeable-object
  function isMergeableObject(value) {
      return isNonNullObject(value) &&
          !isSpecial(value)
  }

  function isNonNullObject(value) {
      return !!value && typeof value === 'object'
  }

  function isSpecial(value) {
      var stringValue = Object.prototype.toString.call(value);

      return stringValue === '[object RegExp]' ||
          stringValue === '[object Date]' ||
          isReactElement(value)
  }

  // see https://github.com/facebook/react/blob/b5ac963fb791d1298e7f396236383bc955f916c1/src/isomorphic/classic/element/ReactElement.js#L21-L25
  var canUseSymbol = typeof Symbol === 'function' && Symbol.for;
  var REACT_ELEMENT_TYPE = canUseSymbol ? Symbol.for('react.element') : 0xeac7;

  function isReactElement(value) {
      return value.$$typeof === REACT_ELEMENT_TYPE
  }

  // c merge and helpers
  // code from https://github.com/KyleAMathews/deepmerge
  function emptyTarget(val) {
      return Array.isArray(val) ? [] : {}
  }

  function cloneUnlessOtherwiseSpecified(value, options) {
      return (options.clone !== false && options.isMergeableObject(value)) ?
          deepmerge(emptyTarget(value), value, options) :
          value
  }

  function mergeObject(target, source, options) {
      var destination = {};
      if (options.isMergeableObject(target)) {
          Object.keys(target).forEach(function(key) {
              destination[key] = cloneUnlessOtherwiseSpecified(target[key], options);
          });
      }
      Object.keys(source).forEach(function(key) {
          if (!options.isMergeableObject(source[key]) || !target[key]) {
              destination[key] = cloneUnlessOtherwiseSpecified(source[key], options);
          } else {
              destination[key] = deepmerge(target[key], source[key], options);
          }
      });
      return destination
  }

  const overwriteMerge = (destinationArray, sourceArray, options) => sourceArray;

  function deepmerge(target, source, options) {
      options = options || {};
      options.arrayMerge = options.arrayMerge || overwriteMerge;
      options.isMergeableObject = options.isMergeableObject || isMergeableObject;

      var sourceIsArray = Array.isArray(source);
      var targetIsArray = Array.isArray(target);
      var sourceAndTargetTypesMatch = sourceIsArray === targetIsArray;

      if (!sourceAndTargetTypesMatch) {
          return cloneUnlessOtherwiseSpecified(source, options)
      } else if (sourceIsArray) {
          return options.arrayMerge(target, source, options)
      } else {
          return mergeObject(target, source, options)
      }
  }

  deepmerge.all = function deepmergeAll(array, options) {
      if (!Array.isArray(array)) {
          throw new Error('first argument should be an array')
      }

      return array.reduce(function(prev, next) {
          return deepmerge(prev, next, options)
      }, {})
  };

  function deepclone(object) {
      return deepmerge({}, object);
  }

  function applyDefaults(config, defaults) {
      const defaultProps = Object.keys(defaults);
      defaultProps.forEach(prop => {
          if (!config.hasOwnProperty(prop))
              if (isMergeableObject(defaults[prop]))
                  config[prop] = deepclone(defaults[prop]); // object
              else
                  config[prop] = defaults[prop]; // non object, e.g. null
          else if (isMergeableObject(defaults[prop]))
              if (isMergeableObject(config[prop]))
                  applyDefaults(config[prop], defaults[prop]);
              else
                  config[prop] = deepclone(defaults[prop]);
      });
      return config;
  }

  function equals(a,b) {
      if (a instanceof Date && b instanceof Date) {
          return a.getTime() === b.getTime();
      }
      return a === b;
  }

  function getTimeInterval(unit) {
      let interval;
      if (interval = d3['utc' + ucFirst(unit)]) return interval;
  }

  function stepIterator(stepUnit, stepSize, domain) {
      let interval;
      if (interval = getTimeInterval(stepUnit)) {
          return function* (min = domain[0], max = domain[1]) { 
              for (let i = min; i <= max; i = interval.offset(i, stepSize) )
                  yield i;
          };
      } else if (stepUnit === "number") {
          return function* (min = domain[0], max = domain[1]) { 
              for (let i = min; i <= max; i += stepSize)
                  yield i;
          };
      } else if (stepUnit === "index") {
          return function* (min, max = domain.length) {
              min = (min === undefined) ? 0 : domain.indexOf(min);
              for (let i = min; i < max; i += stepSize)
                  yield domain[i];
          }
      }
      console.warn("No valid step iterator found.", { stepUnit, stepSize, domain });
  }

  function configValue(value, concept) {
      const { concept_type } = concept;
      if (concept_type == "time" && value instanceof Date) {
          return concept.format ? d3.utcFormat(concept.format)(value) : formatDate(value);
      }
      return value;
  }

  const defaultParsers = [
      d3.utcParse('%Y'),
      d3.utcParse('%Y-%m'),
      d3.utcParse('%Y-%m-%d'),
      d3.utcParse('%Y-%m-%dT%H'),
      d3.utcParse('%Y-%m-%dT%H-%M'),
      d3.utcParse('%Y-%m-%dT%H-%M-%S')
  ];

  function tryParse(timeString, parsers) {
      for (let i = 0; i < parsers.length; i++) {
        let dateObject = parsers[i](timeString);
        if (dateObject) return dateObject;
      }
      console.warn('Could not parse time string ' + timeString);
      return null;
  }

  function parseConfigValue(valueStr, concept) {
      const { concept_type } = concept;

      if (concept_type === "time") {
          let parsers = concept.format 
              ? [d3.utcParse(concept.format), ...defaultParsers]
              : defaultParsers;
          return tryParse(valueStr, parsers);
      }

      if (concept_type === "measure") {
          return +valueStr;
      }

      return ""+valueStr;
  }
  function formatDate(date) {
      var month = date.getUTCMonth(),
          day = date.getUTCDate(),
          hours = date.getUTCHours(),
          minutes = date.getUTCMinutes(),
          seconds = date.getUTCSeconds(),
          milliseconds = date.getUTCMilliseconds();
      return isNaN(date) ? "Invalid Date"
          : milliseconds ? formatFullDate(date) + "T" + pad(hours, 2) + ":" + pad(minutes, 2) + ":" + pad(seconds, 2) + "." + pad(milliseconds, 3) + "Z"
          : seconds ? formatFullDate(date) + "T" + pad(hours, 2) + ":" + pad(minutes, 2) + ":" + pad(seconds, 2) + "Z"
          : minutes || hours ? formatFullDate(date) + "T" + pad(hours, 2) + ":" + pad(minutes, 2) + "Z"
          : day !== 1 ? formatFullDate(date)
          : month ? formatYear(date.getUTCFullYear()) + "-" + pad(date.getUTCMonth() + 1, 2)
          : formatYear(date.getUTCFullYear());
  }

  function formatFullDate(date) {
      return formatYear(date.getUTCFullYear()) + "-" + pad(date.getUTCMonth() + 1, 2) + "-" + pad(date.getUTCDate(), 2);
  }

  function formatYear(year) {
      return year < 0 ? "-" + pad(-year, 6)
          : year > 9999 ? "+" + pad(year, 6)
          : pad(year, 4);
  }

  function pad(value, width) {
      var s = value + "", length = s.length;
      return length < width ? new Array(width - length + 1).join(0) + s : s;
  }
      
  const defer = setTimeout;

  function compose2(f, g) {
      return (...args) => f(g(...args));
  }
  function compose(...fns) {
      return fns.reduce(compose2);
  }
  function pipe(...fns) {
      return fns.reduceRight(compose2);
  }


  function stableStringifyObject(obj) { 
      return JSON.stringify(canonicalObject(obj));
  }

  function canonicalObject(where) {
      if (!isNonNullObject(where)) 
          return where;
      const keys = Object.keys(where).sort();
      return keys.map(key => ({ [key]: canonicalObject(where[key]) }));
  }

  /**
   * Returns value for `key` in `map`. If `key` not in map, first create new value using `create` getter function and set it to `key`.
   * @param {Map} map Map to get from
   * @param {Any} key Key to map
   * @param {Function} create Function which returns new value for new keys
   */
  function getOrCreate(map, key, create) {
      let value;
      if (map.has(key))
          value = map.get(key);
      else {
          value = create();
          map.set(key, value);
      }
      return value;
  }

  var utils = /*#__PURE__*/Object.freeze({
    __proto__: null,
    isNumeric: isNumeric,
    isString: isString$1,
    isEntityConcept: isEntityConcept,
    mapToObj: mapToObj,
    intersect: intersect,
    isProperSubset: isProperSubset,
    relativeComplement: relativeComplement,
    arrayEquals: arrayEquals,
    assign: assign,
    composeObj: composeObj,
    ucFirst: ucFirst,
    getBoundGetter: getBoundGetter,
    moveProperty: moveProperty,
    renameProperty: renameProperty,
    fromPromiseAll: fromPromiseAll,
    defaultDecorator: defaultDecorator,
    combineStates: combineStates,
    isNonNullObject: isNonNullObject,
    deepmerge: deepmerge,
    deepclone: deepclone,
    applyDefaults: applyDefaults,
    equals: equals,
    stepIterator: stepIterator,
    configValue: configValue,
    parseConfigValue: parseConfigValue,
    defer: defer,
    compose: compose,
    pipe: pipe,
    stableStringifyObject: stableStringifyObject,
    getOrCreate: getOrCreate
  });

  const createStore = function(baseType, extendedTypes = {}) {
      return mobx.observable({
          modelTypes: {
              base: baseType,
              all: {
                  baseType,
                  ...extendedTypes
              }
          },
          named: new Map(),
          configRef: new Map(),
          get: function(id) {
              return this.named.get(id);
          },
          addType: function(modelType, modelConstructor) {
              if (this.modelTypes[modelType])
                  console.warn("Adding model type " + modelType + " failed. Type already exists", this);
              this.modelTypes.all[modelType] = modelConstructor;
          },
          getAll: function() {
              return [...this.named.values(), ...this.configRef.values()];
          },
          has: function(id) {
              return this.named.has(id);
          },
          create: function(config, parent) {
              //if (isObservableObject(config)) config = toJS(config);
              let modelType = this.modelTypes.all[config.modelType] || this.modelTypes.base;
              let model = mobx.observable(
                  modelType(config, parent), 
                  modelType.decorate || undefined, 
                  { name: modelType.name || config.modelType || 'base' }
              );
              if (model.setUpReactions) model.setUpReactions();
              return model;
          },
          set: mobx.action('store set', function(config, id, parent) {
              let model = this.create(config, parent);
              id ? this.named.set(id, model) : this.configRef.set(config, model);
              return model;
          }),
          setMany: function(configs) {
              const models = {};
              for (let id in configs) {
                  models[id] = this.set(configs[id], id);
              }
              return models;
          },
          /**
           * Definition is either the (1) model config object or (2) string id of the model  
           * Case 1: creates and returns anonymous model
           * Case 2: tries to fetch model from named models
           * @param {string/object} def 
           * @returns {model} Returns the model that was fetched or created
           */
          getByDefinition(def, parent) {

              // get by config by reference string
              // e.g. "markers.bubbles.encoding.size.data.concept"
              if (isString$1(def.ref) || isNonNullObject(def.ref)) {
                  if (this.configRef.has(def)) {
                      return this.configRef.get(def);
                  }
                  def = resolveRef(def);
              }

              // get by config of another model
              if (isNonNullObject(def) && "config" in def) {
                  def = def.config;
              }

              // get by config object
              if (!isString$1(def) && def !== null) {
                  if (this.configRef.has(def)) {
                      return this.configRef.get(def);
                  }
                  return this.set(def, null, parent);
              }

              // get by string name/id
              if (this.has(def)) {
                  return this.get(def);
              }
              console.warn("Store: cannot find model with definition: ", def, { store: this });
              return null;
          },
          /**
           * 
           * @param {*} defs Object of model definitions
           * @returns {Map} Map with models according to definitions
           */
          getByDefinitions(defs, parent) {
              const map = new Map();
              Object.keys(defs).forEach(prop => {
                  map.set(prop, this.getByDefinition(defs[prop]), parent);
              });
              return map;
          }

      }, {
          named: mobx.observable.shallow,
          configRef: mobx.observable.shallow
      });
  };

  const configurable = {
      applyConfig: mobx.action('applyConfig', function(config) {
          this.config = deepmerge(this.config, config);
          return this;
      })
  };

  // only on base level now, should be recursive
  function dotToJoin(query) {
      const props = query.where && Object.keys(query.where);
      if (!props || props.length == 0)
          return query;

      const where = query.where,
          newq = deepmerge({}, query);

      let i = 0;

      props.forEach(p => {
          const s = p.split('.');
          if (s.length > 1) {
              const [key, value] = s;
              const filter = where[p];

              const joinid = "$" + key + i++;
              delete newq.where[p];
              newq.where[key] = joinid;

              if (!newq.join) newq.join = {};

              newq.join[joinid] = {
                  key: key,
                  where: {
                      [value]: filter
                  }
              };
          }
      });

      console.log("Transformed query: ", query, newq);
      return newq;
  }

  // needed for WS
  function addExplicitAnd(query) {
      // return if no where or only single where
      const props = query.where && Object.keys(query.where);
      if (!props || props.length < 2)
          return query;

      const newq = deepmerge({}, query);
      newq.where = {
          "$and": []
      };
      props.forEach(prop => {
          newq.where["$and"].push({
              [prop]: query.where[prop]
          });
      });

      console.log("Transformed query: ", query, newq);
      return newq;
  }

  const directions = {
      ascending: 1,
      decending: -1
  };

  function order(df, order_by = []) {
      if (order_by.length == 0) return df;

      const data = Array.from(df.values());
      const orderNormalized = normalizeOrder(order_by);
      const n = orderNormalized.length;

      data.sort((a,b) => {
          for (var i = 0; i < n; i++) {
              const order = orderNormalized[i];
              if (a[order.concept] < b[order.concept])
                  return -1 * order.direction;
              else if (a[order.concept] > b[order.concept])
                  return order.direction;
          } 
          return 0;
      });

      return DataFrame(data, df.key);
  }

  /**    
   * Process ["geo"] or [{"geo": "asc"}] to [{ concept: "geo", direction: 1 }];
   * @param {} order 
   */
  function normalizeOrder(order_by) {
      if (typeof order_by === "string") 
          return [{ concept: order_by, direction: directions.ascending }];
      return order_by.map(orderPart => {
          if (typeof orderPart == "string") {
              return { concept: orderPart, direction: directions.ascending };
          }	else {
              const concept   = Object.keys(orderPart)[0];
              const direction = orderPart[concept] == "asc" 
                  ? directions.ascending 
                  : directions.decending;
              return { concept, direction };
          }
      });
  }

  function fullJoin(joinParams, joinKey = joinParams[0].dataFrame.key) {
      
      return joinParams
          .reduce((params, param) => {
              const baseParam = params.find(baseParam => baseParam.dataFrame === param.dataFrame);
              if (baseParam)
                  Object.keys(param.projection).forEach(key => {
                      baseParam.projection[key] = param.projection[key];
                  });
              else
                  params.push(param);
              return params;
          }, [])
          .reduce(
              _fullJoin, 
              DataFrame([], joinKey)
          );

  }

  /**
   * Full join. Impure: Modifies left df. Left key is join key. Right key must contain all join key fields (can't use regular fields for joining).
   * @param {DataFrame} left DataFrame used as base for join
   * @param {*} rightCfg { dataFrame: DataFrame, projection: { origField: projField } }
   */
  function _fullJoin(left, rightCfg) {
      // join or copy right rows onto result
      const joinKey = left.key;
      const dataKey = rightCfg.dataFrame.key;
      const projection = normalizeProjection(rightCfg.projection) || {};

      if (!joinKey.every(dim => dataKey.includes(dim)))
          console.warn("Right key does not contain all join fields.", { left: left, right: rightCfg });
      if (!projection || Object.keys(projection).length === 0)
          console.warn("No projection given for join so no new fields will be joined", { left: left, right: rightCfg } );

      for (let [keyStr, rightRow] of rightCfg.dataFrame) {
          const leftRow = getOrCreateRow(left, joinKey, rightRow, keyStr);  
          // project with aliases        
          for(let key in projection) {
              leftRow[projection[key]] = rightRow[key];
          }
      }

      return left;
  }

  // change array ["geo","year"] to { geo: "geo", year: "year" }
  function normalizeProjection(projection) {
      if (!Array.isArray(projection))
          return projection;
      
      return projection.reduce((obj, field) => {
          obj[field] = field;
          return obj;
      }, {});
  }

  function createObj(space, row, keyStr) {
      const obj = {
          [Symbol.for('key')]: keyStr
      };
      space.forEach(dim => obj[dim] = row[dim]);
      return obj;
  }

  function getOrCreateRow(df, keyArr, row, keyStr) {
      let obj;
      // if (keyStr == undefined) keyStr = createMarkerKey(row, keyArr);
      if (!df.hasByObjOrStr(row, keyStr)) {
          obj = createObj(keyArr, row, keyStr);
          df.set(obj, keyStr);
      } else {
          obj = df.getByObjOrStr(row, keyStr);
      }
      return obj;
  }

  function getIter(iter) {
      if ("values" in iter && typeof iter.values === "function")
          return iter.values();
      return iter;
  }

  function isDataFrame(data) {
      return "hasByObjOrStr" in data && typeof data.hasByObjOrStr === "function";
  }

  // returns true if a and b are identical, regardless of order (i.e. like sets)
  function arrayEquals$1(a, b) {
      const overlap = intersect$1(a, b);
      return overlap.length == a.length && overlap.length == b.length;
  }

  // intersect of two arrays (representing sets)
  // i.e. everything in A which is also in B
  function intersect$1(a, b) {
      return a.filter(e => b.includes(e));
  }

  function isNonNullObject$1(value) {
      return !!value && typeof value === 'object'
  }

  function normalizeKey(key) {
      return key.slice(0).sort();
  }

  const createKeyStr = (key) => key.map(esc).join('-');
  // micro-optimizations below as this is code that runs for each row in data to create key to the row

  const isNumeric$1 = (n) => !isNaN(n) && isFinite(n);

  // TODO: probably use different replace function, long version in jsperf
  // string replace functions jsperf: https://jsperf.com/string-replace-methods
  // regexp not here, not fast in any browser
  /**
   * Verbose string replace using progressive indexOf. Fastest in Chrome.
   * Does not manipulate input string.
   * @param {*} str Input string
   * @param {*} ndl Needle to find in input string
   * @param {*} repl Replacement string to replace needle with
   */
  function replace(str, ndl, repl) {
      var outstr = '',
          start = 0,
          end = 0,
          l = ndl.length;
      if (!str && str !== "" || str === undefined) debugger;
      while ((end = str.indexOf(ndl, start)) > -1) {
          outstr += str.slice(start, end) + repl;
          start = end + l;
      }
      return outstr + str.slice(start);
  }

  // precalc strings for optimization
  const escapechar = "\\";
  const joinchar = "-";
  const dblescape = escapechar + escapechar;
  const joinescape = escapechar + joinchar;
  var esc = str => {
      if (str instanceof Date) str = str.toISOString();
      if (isNumeric$1(str)) return str;
      return replace(replace(str, escapechar, dblescape), joinchar, joinescape);
  };

  // jsperf of key-creation options. Simple concat hash + escaping wins: https://jsperf.com/shallow-hash-of-object
  // for loop is faster than keys.map().join('-');
  // but in Edge, json.stringify is faster
  // pre-escaped space would add extra performance
  const createDimKeyStr = (dim, dimVal) => {
      if (dimVal instanceof Date) dimVal = dimVal.toISOString();
      //if (!dim || !dimVal) debugger;
      return esc(dim) + joinchar + esc(dimVal);
  };
  const createMarkerKey = (row, space = Object.keys(row).sort()) => {
      const l = space.length;

  /*    if (l===1)
          return createDimKeyStr(space[0],row[space[0]]+"";
  */

      // space.map(c => createDimKeyStr(row[c]))).join(joinchar);
      var res = (l > 0) ? createDimKeyStr(space[0], row[space[0]]) : '';
      for (var i = 1; i < l; i++) {
          res += joinchar + createDimKeyStr(space[i], row[space[i]]);
      }
      return res
  };

  const createKeyFn = (space) => {
      const spaceEsc = space.map(esc);
      const l = space.length;
      return (row) => {
          const parts = [];
          let field, i, j;
          for (i = j = 0; i < l; i++, j+=2) {
              parts[j] = field = spaceEsc[i]; 
              parts[j+1] = esc(row[field]);
          }
          return parts.join(joinchar);
      }
  };

  function parseMarkerKey(str) {
      // "remove" escaping by splitting to be able to split on actual joins
      // then, put it back together
      var parts = str.split(dblescape).map(
          s => s.split(joinescape).map(
              s => s.split(joinchar)
          )
      );
      var values = [];
      var val = '';
      for (let i = 0; i < parts.length; i++) {
          for (let j = 0; j < parts[i].length; j++) {
              for (let k = 0; k < parts[i][j].length; k++) {
                  // double escape found, glue again with escape char
                  if (j === 0 && k === 0) {
                      if (i !== 0) val += escapechar;
                      val += parts[i][j][k];
                  } 
                  // joinescape found, glue again with join char
                  else if (k === 0) {
                      if (j !== 0) val += joinchar;
                      val += parts[i][j][k];
                  }
                  // actual joinchar found, correct split
                  else {
                      values.push(val);
                      val = parts[i][j][k];    
                  }
              }
          }
      }
      values.push(val);

      // create key, odd is dim, even is dimension value
      const key = {};
      for (let i = 0; i < values.length; i += 2) {
          key[values[i]] = values[i+1];
      }
      return key;
  }

  function rangeIndex(index = 0) {
      return (row, key) => index++;
  }

  function MapStorage(data = [], keyArr = data.key || []) {
      
      const storage = createEmptyMap();
      storage.key = keyArr;
      storage.batchSet(data);

      return storage;
  }

  function createEmptyMap() {
      const storage = new Map();
      let key = [], isRangeKey;

      // local references to functions which will be decorated
      const has = storage.has.bind(storage);
      const get = storage.get.bind(storage);
      const set = storage.set.bind(storage);

      storage.fields = new Set();
      storage.keyFn = rangeIndex(0);
      storage.setKey = newKey => {
          key = normalizeKey(newKey); 
          isRangeKey = key.length === 0; 
          storage.keyFn = isRangeKey ? rangeIndex(0) : createKeyFn(storage.key);
          storage.updateIndexes(storage);
      };
      Object.defineProperty(storage, 'key', { 
          set: storage.setKey,
          get: () => key
      });
      storage.has = keyObj => isRangeKey ? false     : has(storage.keyFn(keyObj));
      storage.get = keyObj => isRangeKey ? undefined : get(storage.keyFn(keyObj));
      storage.set = (row, keyStr) => {
          // passing keyStr is optimization to circumvent keyStr generation (TODO: check performance impact)
          // if keyStr set, we assume it's correct. Only use when you know keyStr fits with current key dims
          if (keyStr === undefined || isRangeKey)
              keyStr = storage.keyFn(row, key);
          checkFields(storage.fields, row);
          row[Symbol.for('key')] = keyStr;
          set(keyStr, row);
      };
      storage.hasByObjOrStr = (keyObj, keyStr) => has(keyStr);
      storage.getByObjOrStr = (keyObj, keyStr) => get(keyStr);
      storage.batchSet = rowIter => batchSet(storage, rowIter);
      storage.rows = storage.values;
      storage.updateIndexes = () => updateIndexes(storage);
      return storage;
  }

  function checkFields(fields, row) {
      for (let field in row) {
          if (!fields.has(field)) {
              fields.add(field);
          }
      }
  }

  function batchSet(storage, rowIter) {
      const duplicates = [];

      rowIter = getIter(rowIter);

      for (let row of rowIter) {
          if (storage.has(row))
              duplicates.push({ keyStr: storage.keyFn(row), orig: storage.get(row), new: row});
          storage.set(row);
      }

      if (duplicates.length > 0)
          console.warn('Found duplicates for given key when constructing dataframe.', { key: storage.key, duplicates });
  }

  function updateIndexes(storage) {
      for (let [key, row] of storage) {
          storage.delete(key);
          // set won't overwrite any not-yet-deleted keys 
          // because key dims are either different 
          // or if they're identical, we just removed the key it would overwrite
          storage.set(row); 
      }
  }

  /**
   * Virtual data frame storage based on lookups. A row is constructed on request from lookups for each dimension of requested key.
   * @param {*} concepts Map of concepts. Each concept is a map of dimensions. Each dimension is a map of values on that dimension. E.g. name=>geo=>swe=>Sweden
   */
  function LookupStorage(concepts, keyArr) {
      const storage = {};
      storage.key = keyArr = normalizeKey(keyArr);
      storage.fields = new Set([...keyArr, ...concepts.keys()]);
      storage.data = concepts;
      storage.has = (keyObj) => {
          // true if there is at least one concept which has a lookup for every dimension in key
          // i.e. a row can be returned for this key
          return true; //[...concepts.values()].some(lookups => keyArr.every(dim => dim in keyObj && lookups.has(dim)));
      };
      storage.get = (keyObj) => {
          const row = {};
          concepts.forEach((lookups, concept) => {
              const entityProps = {};
              keyArr.forEach(dim => {
                  if (lookups.has(dim))
                      entityProps[dim] = lookups.get(dim).get(keyObj[dim]);
                  else
                      entityProps[dim] = keyObj[dim];
              });
              row[concept] = entityProps;
          });
          return row;
      };
      storage.hasByObjOrStr = (keyObj, keyStr) => storage.has(keyObj);
      storage.getByObjOrStr = (keyObj, keyStr) => storage.get(keyObj);
      storage.set = (keyObj, value) => { 
          console.warn("Invalid operation. Generated dataframe does not support .set().");
      };
      storage.values = () => { console.warn("Generated dataframe .values() not implemented yet");};
      storage.delete = () => { console.warn("Invalid operation. Generated dataframe does not support .delete()");};
      storage[Symbol.iterator] = function* generate() {
          console.warn("Invalid operation. Generated dataframe iterator not yet implemented.");
      }; 
      return storage;
  }

  function copyColumn(df, srcCol, newCol) {
      for (let row of df.values()) {
          row[newCol] = row[srcCol];
      }
      return df;
  }

  // TODO: add check for non-marker space dimensions to contain only one value
          // -> save first row values and all next values should be equal to first

  /**
   * Join right on left with overlapping columns of key as join columns.
   * @param {*} left 
   * @param  {...any} rights 
   */
  function leftJoin(left, rights) {
      const leftDf = left.dataFrame;
      const leftKey = leftDf.key;
      
      const rightCopies = rights.filter(r => leftKey.some(d => d in r.projection));
      rights = rights.filter(r => !rightCopies.includes(r)).map(r => { 
          const sameKey = arrayEquals$1(r.dataFrame.key, leftKey);
          r.hasFn = sameKey ? "hasByObjOrStr" : "has";
          r.getFn = sameKey ? "getByObjOrStr" : "get";
          return r;
      });

      const result = DataFrame([], leftKey);

      for (let [keyStr, row] of leftDf) {
          // left row as base
          const leftRow = cloneRow(row);
          
          // join any rows in right dfs which have same key as left row
          for (let { dataFrame, projection, hasFn, getFn } of rights) {
              if (dataFrame[hasFn](row, keyStr)) {
                  const rightRow = dataFrame[getFn](row, keyStr);
                  for(let key in projection) {
                      leftRow[projection[key]] = rightRow[key];
                  }
              }
          }
          
          // set row
          result.set(leftRow, keyStr);
      }
      for (let right of rightCopies) {
          // weird chrome bug: using for(let col in right.projection) in combination with 
          // assigning right.projection[col] to var or passing into function crashes chrome
          // therefore for...of w/ object.keys
          // for(let col in right.projection) {
          for (let col of Object.keys(right.projection)) { 
              copyColumn(result, col, right.projection[col]); 
          }   
      }
      return result;
  }

  function joinRows(...rows) {
      return Object.assign(...rows);
  }
  function cloneRow(row) {
      return joinRows({}, row);
  }

  /**
   * Filters dataframe based on either filter function or DDFQL filter specification
   * @param {DataFrame} df 
   * @param {Function|FilterSpec} filter 
   */
  function filter(df, filter) {

      if (!validFilterArg(filter))
          return df;

      const filterFn = (typeof filter == "function") ? 
          filter : createFilterFn(filter);    

      const result = DataFrame([], df.key);
      for(let [key, row] of df) {
          if (filterFn(row))
              result.set(row, key);
      }

      return result;
  }

  function validFilterArg(filter) {
      return filter && (typeof filter === "function" || Object.keys(filter).length > 0)
  }

  /**
   * Partially apply applyFilterRow, giving only the filter spec
   * @param {Object} filterSpec Filter specification according to DDFQL WHERE spec
   * @returns {Function} Filter function, which takes an object and returns a boolean representing if the object satifies the filterSpec
   */
  function createFilterFn(filterSpec) {
      return (row) => applyFilterRow(row, filterSpec);
  }

  function applyFilterRow(row, filter) {
      // implicit $and in filter object handled by .every()
      return Object.keys(filter).every(filterKey => {
          let operator;
          if (operator = operators.get(filterKey)) {
              // { $eq: "europe" } / { $lte: 5 } / { $and: [{...}, ...] }
              return operator(row, filter[filterKey]);
          } else if(typeof filter[filterKey] != "object") { // assuming values are primitives not Number/Boolean/String objects
              // { <field>: <value> } is shorthand for { <field>: { $eq: <value> }} 
              return operators.get("$eq")(row[filterKey], filter[filterKey]);
          } else {
              // filterSpec[filterKey] is an object and will thus contain a comparison operator
              // { <field>: { $<operator>: <value> }}
              // no deep objects (like in Mongo) supported:
              // { <field>: { <subfield>: { ... } } }
              return applyFilterRow(row[filterKey], filter[filterKey]);
          }
      });
  }

  const operators = new Map([
      /* logical operators */
      ["$and", (row, predicates) => predicates.every(p => applyFilterRow(row,p))],
      ["$or",  (row, predicates) => predicates.some(p => applyFilterRow(row,p))],
      ["$not", (row, predicate) => !applyFilterRow(row, predicate)],
      ["$nor", (row, predicates) => !predicates.some(p => applyFilterRow(row,p))],

      /* comparison operators */
      ["$eq",  (rowValue, filterValue) => rowValue === filterValue],
      ["$ne",  (rowValue, filterValue) => rowValue !== filterValue],
      ["$gt",  (rowValue, filterValue) => rowValue > filterValue],
      ["$gte", (rowValue, filterValue) => rowValue >= filterValue],
      ["$lt",  (rowValue, filterValue) => rowValue < filterValue],
      ["$lte", (rowValue, filterValue) => rowValue <= filterValue],
      ["$in",  (rowValue, filterValue) => filterValue.includes(rowValue)],
      ["$nin", (rowValue, filterValue) => !filterValue.includes(rowValue)],
  ]);

  // use projection feature of full join
  const project = (df, projection) => fullJoin([{ dataFrame: df, projection: projection }]);

  /**
   * Adds column to df, in place
   * @param {DataFrame} df 
   * @param {string} name 
   * @param {value|function} value 
   */
  function addColumn(df, name, value) {
      if (typeof value == "function") {
          for (let row of df.values()) {
              row[name] = value(row);
          }
      }
      else {    
          for (let row of df.values()) {
              row[name] = value;
          }
      }
      return df;
  }

  function interpolate(df) {
      return interpolateAllFields(df);
  }

  function interpolateAllFields(df) {
      for (let field of df.fields) {
          interpolateField(df, field);
      }
      return df;
  }

  function interpolateField(df, field) {
      let prevVal = null;
      let gapRows = [];
      for (let row of df.values()) {
          const fieldVal = row[field];
          if (fieldVal === undefined || fieldVal === null) {
              gapRows.push(row);
          } else {
              // fill gap if it exists and is inner
              if (prevVal != null && gapRows.length > 0) {
                  interpolateGap(gapRows, prevVal, fieldVal, field);
              }
              gapRows = [];
              prevVal = fieldVal;
          }
      }
  }

  function interpolateGap(gapRows, startVal, endVal, field) {
      const int = d3.interpolate(startVal, endVal);
      const delta = 1 / (gapRows.length+1);
      let mu = 0;
      for (let gapRow of gapRows) {
          mu += delta;
          gapRow[field] = int(mu);
      }
  }

  // TODO: add check if there are rows that are don't fit stepfn 
  // (iterate over df and match one step of stepfn with step of iteration)
  function reindex(df, stepGen) {
      const empty = createEmptyRow(df.fields);
      const result = DataFrame([], df.key);
      const index = df.key[0]; // supports only single indexed
      for (let key of stepGen()) {
          const keyObj = { [index]: key };
          const row = df.has(keyObj) 
              ? df.get(keyObj)
              : Object.assign({ }, empty, keyObj);
          result.set(row);
      }
      return result;
  }

  function createEmptyRow(fields) {
      const obj = {};
      for (let field of fields) obj[field] = null;
      return obj;
  }

  /**
   * 
   * @param {*} df DataFrame from which to create groups
   * @param {*} key key by which is grouped
   * @param {*} descKeys keys of groups and their descendants
   */
  function DataFrameGroupMap(df, key, descKeys = []) {

      if (!Array.isArray(descKeys)) descKeys = [[descKeys]]; // desc keys is single string (e.g. 'year')
      if (!Array.isArray(descKeys[0])) descKeys = [descKeys]; // desc keys is one key (e.g. ['year'])
      if (!Array.isArray(key)) key = [key]; // key is single string (e.g. 'year')
      if (!isDataFrame(df)) df = DataFrame(df);
      if (descKeys.length === 0) descKeys = [df.key];  // descKeys is empty
      
      const groupMap = createGroupMap(key, descKeys);

      for (let row of df.values()) {
          groupMap.setRow(row);
      }

      return groupMap; 
  }

  function createGroupMap(key, descendantKeys) {
      const groupMap = new Map();
      groupMap.key = key;
      groupMap.keyFn = createKeyFn(key);
      groupMap.descendantKeys = descendantKeys;
      groupMap.groupType = () => groupMap.descendantKeys.length === 1 ? 'DataFrame' : 'GroupMap';
      groupMap.each = (fn) => each(groupMap, fn);
      groupMap.map = (fn) => map(groupMap, fn);
      // groupMap.mapCall = (fn) => mapCall(groupMap, fn); // not exposing mapcall
      groupMap.interpolate = mapCall(groupMap, "interpolate");
      groupMap.filter = mapCall(groupMap, "filter");
      groupMap.order = mapCall(groupMap, "order");
      groupMap.reindex = mapCall(groupMap, "reindex");
      groupMap.flatten = (key) => flatten(groupMap, key);
      groupMap.groupBy = (key) => {
          for (let group of groupMap.values()) {
              const newGroup = group.groupBy(key);

              // groups change from DataFrame to GroupMap
              if (groupMap.groupType() === 'DataFrame')
                  groupMap.set(key, newGroup);
          }
          groupMap.descendantKeys.push(key);
          return groupMap;
      };
      groupMap.createChild = (keyStr) => createChild(groupMap, keyStr);
      groupMap.toJSON = () => mapToObject(groupMap);
      groupMap.rows = function* () {
          let group, row; 
          for (group of groupMap.values()) {
              for (row of group.rows()) // get rows recursively
                  yield row;
          }
      };
      groupMap.filterGroups = (filterFn) => {
          let result = DataFrameGroupMap([], groupMap.key, groupMap.descendantKeys);
          for (let [key, group] of groupMap) {
              const newGroup = group.filterGroups(filterFn);
              if (filterFn(newGroup)) 
                  result.set(key, newGroup);
          }
          return result;
      };
      groupMap.setRow = (row) => {
          getOrCreateGroup(groupMap, row)
              .setRow(row);
      };
      return groupMap;
  }

  function each(grouping, fn) {
      for (let [key, df] of grouping) {
          fn(df, parseMarkerKey(key));
      }
      return grouping;
  }

  function map(grouping, fn) {
      for (let [key, df] of grouping) {
          grouping.set(key, fn(df, parseMarkerKey(key)));
      }
      return grouping;
  }

  function mapCall(groupMap, fnName) {
      return function() {
          let result = DataFrameGroupMap([], groupMap.key, groupMap.descendantKeys);
          for (let [key, group] of groupMap) {
              result.set(key, group[fnName](...arguments));
          }
          return result;
      }
  }

  /**
   * 
   * @param {*} group the group to find member in
   * @param {*} row data row to find member for
   */
  function getOrCreateGroup(groupMap, row) {
      let group;
      const keyStr = groupMap.keyFn(row);
      if (groupMap.has(keyStr)) {
          group = groupMap.get(keyStr);
      } else {
          group = groupMap.createChild(keyStr);
      }
      return group;
  }

  function createChild(groupMap, keyStr) {
      // DataFrames have no children of their own (= leafs)
      const child = groupMap.descendantKeys.length === 1
          ? DataFrame([], groupMap.descendantKeys[0])
          : DataFrameGroupMap([], groupMap.descendantKeys[0], groupMap.descendantKeys.slice(1));
      
      groupMap.set(keyStr, child);
      return child;
  }

  function flatten(group, key = []) {
      function* entries() {
          for (let df of group.values()) {
              for (let row of df.values()) {
                  yield row;
              }
          }
      }
      return DataFrame(entries(), key);
  }

  function groupBy(df, groupKey, memberKey = df.key) {

      return DataFrameGroupMap(df, groupKey, memberKey);
      
  }

  function fillNull(df, fillValues) {
      let concept, row;
      // per concept fill
      if (isNonNullObject$1(fillValues)) {
          for (concept in fillValues) {
              const fillValue = fillValues[concept];
              // per concept function fill
              if (typeof fillValue == "function") {
                  for (row of df.values()) {
                      if (row[concept] === null)
                          row[concept] = fillValue(row);
                  }
              }
              // per concept constant fill
              else {
                  for (row of df.values()) {
                      if (row[concept] === null)
                          row[concept] = fillValue;
                  }
              }
          }
      }
      // constant fill
      else {
          for (row of df.values()) {
              for (concept in row) {
                  if (row[concept] === null)
                      row[concept] = fillValues;
              }
          }
      }
      return df;
  }

  // in the style of d3.extent
  function extent(iter, concept) {
      iter = getIter(iter);
      let min, max, value, row;
      for (row of iter) {
          if ((value = row[concept]) != null && value >= value) {
              if (min === undefined) {
                  // find first comparable values
                  min = max = value;
              } else {
                  // compare remaining values 
                  if (min > value) min = value;
                  if (max < value) max = value;
              }
          }
      }
      return [min, max];
  }

  function unique(iter, concept) {
      iter = getIter(iter);
      
      const unique = new Set();
      for (let row of iter) 
          unique.add(row[concept]); 

      return [...unique];
  }

  const copy = df => DataFrame(df);

  //df.get(["swe","2015"]).population
  const fromLookups = (concepts, key) => constructDataFrame(LookupStorage(concepts, key));
  const fromArray = (data = [], key = data.key || []) => constructDataFrame(MapStorage(data, key));

  const DataFrame = fromArray;
  DataFrame.fromLookups = fromLookups;
  DataFrame.fromArray = fromArray;

  function constructDataFrame(storage) {
      // https://medium.com/javascript-scene/the-hidden-treasures-of-object-composition-60cd89480381
      // compose storage and DF methods by concatenation 
      // concatenation instead of aggregation/delegation as there is no overlap in keys and 
      // we want the full storage API to be available on the DataFrame
      const df = Object.assign(storage,
          {        
              // transforms
              order: (direction) => order(df, direction), 
              leftJoin: (rightJoinParams) => leftJoin({ dataFrame: df }, rightJoinParams),
              fullJoin: (joinParams, key) => fullJoin([{ dataFrame: df }, ...joinParams], key),
              copyColumn: (src, dest) => copyColumn(df, src, dest),
              filter: (filterObj) => filter(df, filterObj),
              project: (projection) => project(df, projection),
              addColumn: (name, value) => addColumn(df, name, value),
              groupBy: (groupKey, memberKey) => groupBy(df, groupKey, memberKey),
              interpolate: () => interpolate(df),
              reindex: (stepFn) => reindex(df, stepFn),
              fillNull: (fillValues) => fillNull(df, fillValues),
              copy: () => copy(df),
      
              // info
              extent: (concept) => extent(df, concept),
              unique: (concept) => unique(df, concept),
          
              // export
              toJSON: () => [...df.values()]
          },
          {
              filterGroups: filterFn => {
                  return df.copy();
              },
              setRow: row => df.set(row)
          }
      );

      return df;
  }

  function inlineReader({ values = [], keyConcepts = [], dtypes }) {
      const dataPromise = Promise.resolve(values)
          .then(parse(dtypes))
          .then(DataFrame);

      return {
          async read(query) {
              let data = await dataPromise;

              if (isConceptQuery(query))
                  data = DataFrame(getConcepts(data), ["concept"]);

              if (isSchemaQuery(query))
                  data = DataFrame(getSchema(data, query, keyConcepts), ["key","value"]);

              return applyQuery(data, query);
          },
          getAsset(assetId) {
              console.warn('Inline reader does not support assets', { assetId });
          },
          async getDefaultEncoding() {
              const data = await dataPromise;
              const encConfig = {};
              data.fields.forEach(concept => {
                  encConfig[concept] = {
                      concept, 
                      space: keyConcepts
                  };
              });
              return encConfig;
          }
      }
  }

  function isConceptQuery(query) {
      return "from" in query && query.from == "concepts";
  }

  function isSchemaQuery(query) {
      return "from" in query && query.from.endsWith('.schema');
  }

  function getConcepts(data) {
      const types = getTypes(data);
      return [...data.fields].map(concept => ({
          concept,
          concept_type: types.get(concept)
      }));
  }

  function getSchema(data, { from }, keyConcepts) {
      if (from == "datapoints.schema") {
          const indicatorConcepts = relativeComplement(keyConcepts, [...data.fields]);
          return indicatorConcepts.map(concept => ({
              key: [...keyConcepts],
              value: concept
          }));        
      }
      if (from == "concepts.schema") {
          return [{ key: ["concept"], value: "concept_type"}];
      }
      if (from == "entities.schema") {
          return [];
      }
      console.warn("Invalid schema query `from` clause: ", from);
  }

  function applyQuery(data, query) {
      const { select, from, where, order_by, join } = query;
      const { key, value } = select;
      const projection = [...key, ...value];

      if ("join" in query)
          console.warn('Inline reader does not handle joins as it handles only one table.', { query });

      const result = data
          .filter(where)
          .project(projection)
          .order(order_by);
      return result;
  }

  /*
  {
      year: { timeFormat: "%Y", locale: "ru-RU" }
      pop: number
  }
  */
  function parse(dtypes) {
      const parseRow = parserFromDtypes(dtypes);
      return function(data) {
          let row;
          for (row of data) {
              parseRow(row); // in place
          }
          return data;
      }
  }

  const dtypeParsers = {
      string: d => d,
      number: d => +d,
      auto: autoParse,
      year: d3.utcParse("%Y"),
      month: d3.utcParse("%Y-%m"),
      day: d3.utcParse("%Y-%m-%d")
  };

  function parserFromDtypes(dtypes) {

      if (dtypes == "auto") 
          return d3.autoType;

      // create field parsers
      const parsers = {};
      let field;
      
      for (field in dtypes) {
          const dtype = dtypes[field];

          let parser;
          if (dtype in dtypeParsers) parser = dtypeParsers[dtype];
          if ("timeFormat" in dtype) parser = d3.timeParse(dtype.timeFormat);

          if (!parser) console.warn('Unknown date type given, fall back to identity parser.', dtype);
          parsers[dtype] = parser || (d => d);
      }

      // return row parser
      return (row) => {
          let parse, field;
          for (field in row) {
              if (parse = parsers[field]) 
                  row[field] = parse(row[field]);
          }
      }
  }

  /**
   * Parse string to js primitives or Date. Based on d3.autoType
   * @param {any} value Value to be parsed 
   */
  function autoParse(value) {
      var value = value.trim(), number;
      if (!value) value = null;
      else if (value === "true") value = true;
      else if (value === "false") value = false;
      else if (value === "NaN") value = NaN;
      else if (!isNaN(number = +value)) value = number;
      else if (/^([-+]\d{2})?\d{4}(-\d{2}(-\d{2})?)?(T\d{2}:\d{2}(:\d{2}(\.\d{3})?)?(Z|[-+]\d{2}:\d{2})?)?$/.test(value)) value = new Date(value);
      return value;
  }

  function getTypes(data) {
      const types = new Map();

      // get types from first row
      const [firstRow] = data.values();
      for (let field in firstRow) {
          types.set(field, getType(firstRow[field]));
      }
      // check if those types are consistent
      for (let [field, type] in types) {
          if (!validateType(storage, field, type)) {
              console.warn("Field " + field + " is not consistently typed " + type);
              types.set(field, "mixed");
          }
      }
      return types;
  }

  function validateType(storage, field, type) {
      for (row of storage.values()) {
          if (getType(row[field]) !== type)
              return false;
      }
  }

  function getType(value) {
      if (isDate(value))    return 'time';
      if (isString$2(value))  return 'string';
      if (isNumber(value))  return 'measure';
      if (isBoolean(value)) return 'boolean';
      console.warn("Couldn't decide type of value.", { value });
  }

  const isDate = val => val instanceof Date;
  const isNumber = val => typeof val === "number" || !!val && typeof val === "object" && Object.prototype.toString.call(val) === "[object Number]";
  const isString$2 = val => typeof val === "string";
  const isBoolean = val => typeof val === "boolean";

  function csvReader({ path = "data.csv", keyConcepts = [], dtypes }) {

      return inlineReader({ 
          values: d3.csv(path, d3.autoType),
          keyConcepts,
          dtypes
      });
      
  }

  function makeCache() {
      const cache = new Map();

      const makeKey = function(query) {
          if (query.select.value.length > 1) {
              console.info('Cache can\'t handle query with more than one select value. Skipping query caching.', query);
              return undefined;
          }
          return stableStringifyObject(query);
      };
      const has = function (query) { return cache.has(makeKey(query)); };
      const get = function (query) { return cache.get(makeKey(query)); };
      const set = function(query, response) {
          if (query.select.value.length > 1) 
              return splitQuery(query).map(q => set(q, response));
          
          const key = makeKey(query);
          return cache.set(key, response);
      };
      const setFromPromise = function(query, promise) {
          return promise.then(response => set(query, response))
      };
      const splitQuery = function(query) {
          return query.select.value.map(concept => {
              const clone = deepclone(query);
              clone.select.value = [concept];
              return clone;
          });
      };

      return {
          has, 
          get, 
          set,
          setFromPromise
      }
  }

  const defaultConfig = {
      path: null,
      values: null,
      transforms: []
  };

  const functions = {
      get path() { return this.config.path },
      get space() { return this.config.space },
      get reader() {
          if (this.values)
              return inlineReader({ values: this.values });
          else if (this.path)
              return csvReader({ path: this.path });
          console.warn("No inline values or csv path found. Please set `values` or `path` property on dataSource.", this);
      },
      get values() { 
          // toJS: don't want insides of data to be observable (adds overhead & complexity)
          return mobx.toJS(this.config.values);
      },
      get availability() {
          let empty = this.buildAvailability();
          return this.availabilityPromise.case({
              fulfilled: v => v,
              pending: () => { console.warn('Requesting availability before availability loaded. Will return empty. Recommended to await promise.'); return empty },
              error: (e) => { console.warn('Requesting availability when loading errored. Will return empty. Recommended to check promise.'); return empty }
          })
      },
      get concepts() {
          mobx.trace();
          const empty = new Map();
          return this.conceptsPromise.case({
              fulfilled: v => DataFrame(v, ["concept"]),
              pending: () => { console.warn('Requesting concepts before loaded. Will return empty. Recommended to await promise.'); return empty },
              error: (e) => { console.warn('Requesting concepts when loading errored. Will return empty. Recommended to check promise.'); return empty }
          })
      },
      get defaultEncodingPromise() {
          if ("getDefaultEncoding" in this.reader)
              return this.reader.getDefaultEncoding();
          else    
              return Promise.resolve({});
      },
      get defaultEncoding() {
          const empty = {};
          return this.defaultEncodingPromise.case({
              fulfilled: v => {
                  Object.values(v).forEach(enc => enc.source = this);
                  return v;
              },
              pending: () => { console.warn('Requesting default encoding before loaded. Will return empty. Recommended to await promise.'); return empty },
              error: (e) => { console.warn('Requesting default encoding when loading errored. Will return empty. Recommended to check promise.'); return empty }
          });
      },
      buildAvailability(responses = []) {
          const 
              keyValueLookup = new Map(),
              keyLookup = new Map(),
              data = [];

          /* utility functions, probably move later */
          const getFromMap = (map, key, getNewVal) => {
              map.has(key) || map.set(key, getNewVal());
              return map.get(key);
          };
          const getNewMap = () => new Map();
          const getMapFromMap = (map, key) => getFromMap(map, key, getNewMap);

          /* handle availability responses */
          responses.forEach(response => {
              response = response.values ? response.values() : response; // get dataframe iterator if there
              for(let row of response) {
                  let keyStr, valueLookup;
                  row.key = Array.isArray(row.key) ? row.key : JSON.parse(row.key).sort();
                  keyStr = createKeyStr(row.key);
                  data.push(row);
                  keyLookup.set(keyStr, row.key);
                  valueLookup = getMapFromMap(keyValueLookup, keyStr);
                  valueLookup.set(row.value, row);    
              }        });

          return {
              keyValueLookup,
              keyLookup,
              data
          };
      },
      get availabilityPromise() {
          mobx.trace();
          const collections = ["concepts", "entities", "datapoints"];
          const getCollAvailPromise = (collection) => this.query({
              select: {
                  key: ["key", "value"],
                  value: []
              },
              from: collection + ".schema"
          });

          return fromPromise(Promise.all(collections.map(getCollAvailPromise))
              .then(this.buildAvailability));
      },
      get conceptsPromise() {
          mobx.trace();
          return fromPromise(this.availabilityPromise.then(av => {
              const concepts = ["name", "domain", "concept_type", "scales"];
              const conceptKeyString = createKeyStr(["concept"]);
              const avConcepts = concepts.filter(c => av.keyValueLookup.get(conceptKeyString).has(c));
      
              const query = {
                  select: {
                      key: ["concept"],
                      value: avConcepts
                  },
                  from: "concepts"
              };           

              return this.query(query);
          }));
      },
      get metaDataPromise() {
          return fromPromise(Promise.all([this.availabilityPromise, this.conceptsPromise, this.defaultEncodingPromise]));
      },
      /* 
      *  separate state computed which don't become stale with new promise in same state 
      *  might use these later to make own .case({pending, fulfilled, rejected}) functionality    
      */
      get availabilityState() {
          return this.availabilityPromise.state;
      },
      get conceptsState() {
          return this.conceptsPromise.state;
      },
      get state() {
          return this.metaDataPromise.state;
      },
      getConcept(concept) {
          if (concept == "concept_type" || concept.indexOf('is--') === 0 || concept === "concept")
              return { concept, name: concept }
          if (!this.concepts.has({ concept }))
              console.warn("Could not find concept " + concept + " in data source ", this);
          return this.concepts.get({ concept }) || {};
      },
      isEntityConcept(conceptId) {
          return ["entity_set", "entity_domain"].includes(this.getConcept(conceptId).concept_type);
      },
      query(query) {
          //return [];
          query = dotToJoin(query);
          query = addExplicitAnd(query);
          console.log('Adding to queue', query);
          const queryPromise = this.enqueue(query);
          return fromPromise(queryPromise);
      },
      queue: [],
      enqueue(query) {
          return new Promise((resolve, reject) => {
              this.queue.push({ query, resolves: [resolve], rejects: [reject] });
              // defer so queue can fill up before queue is processed
              // only first of deferred process calls will find a filled queue
              defer(() => this.processQueue(this.queue));
          })
      },
      processQueue(queue) {
          return pipe(
              this.resolveCached.bind(this),
              this.combineQueries.bind(this), 
              this.sendQueries.bind(this),
              this.setQueueHandlers.bind(this),
              this.addToCache.bind(this),
              this.clearQueue.bind(this)
          )(queue);
      },
      combineQueries(queue) {
          const queries = queue.reduce((queries, { query, resolves, rejects }) => {
              const queryCombineId = this.calcCombineId(query);
              if (queries.has(queryCombineId)) {
                  const { 
                      query: combinedQuery, 
                      resolves: combinedResolves, 
                      rejects: combinedRejects 
                  } = queries.get(queryCombineId);
                  const additionalValues = query.select.value.filter(v => combinedQuery.select.value.includes(v) === false);
                  combinedQuery.select.value.push(...additionalValues);
                  combinedResolves.push(...resolves);
                  combinedRejects.push(...rejects);
              } else {
                  queries.set(queryCombineId, {
                      query: deepclone(query),
                      resolves,
                      rejects
                  });
              }
              return queries;
          }, new Map());
          return [...queries.values()];
      },
      cache: makeCache(),
      resolveCached(queries) {
          return queries.filter(query => !this.tryCache(query));
      },
      tryCache({ query, resolves }) {
          let response;
          if (response = this.cache.get(query)) {
              console.warn('Resolving query from cache.', query);
              resolves.forEach(resolve => resolve(response));
              return true;
          }
          return false;
      },
      sendQueries(queries) {
          return queries.map(({ query, resolves, rejects }) => {
              console.log('Sending query to reader', query);
              const promise = this.reader.read(query);
              return {
                  query, resolves, rejects, promise
              };
          });
      },
      setQueueHandlers(queries) {
          queries.forEach(({ promise, resolves, rejects }) => {
              resolves.forEach(res => promise.then(res));
              rejects.forEach(rej => promise.catch(rej));
          });
          return queries;
      },
      addToCache(queries) {
          queries.forEach(({ query, promise }) => {
              this.cache.setFromPromise(query, promise);
          });
          return queries;
      },
      clearQueue() {
          this.queue.length = 0; // reset without changing ref
      },
      calcCombineId(query) {
          const clone = deepclone(query);
          delete clone.select.value;
          return stableStringifyObject(clone);
      }
  };

  function baseDataSource(config) {
      applyDefaults(config, defaultConfig);
      return assign({}, functions, configurable, { config });
  }

  baseDataSource.decorate = {
      // to prevent config.values from becoming observable
      // possibly paints with too broad a brush, other config might need to be deep later
      config: mobx.observable.shallow,
      // queue should be mutable by computed methods
      // this is introducing state manipulation and makes these computed methods impure
      // other solutions are welcome : )
      queue: mobx.observable.ref,
      cache: mobx.observable.ref
  };

  const dataSourceStore = createStore(baseDataSource);

  dataSourceStore.createAndAddType = function(type, readerObject) {
      this.addType(type, defaultDecorator({
          base: baseDataSource,
          functions: {
              get reader() {
                  // copy reader object (using original would only allow one datasource of this type)
                  const reader = Object.assign({}, readerObject);
                  reader.init(this.config || {});
                  return reader;
              }
          }
      }));
  };

  const defaultConfig$1 = {
      markers: {},
      dimensions: {}
  };

  function filter$1(config = {}, parent) {

      applyDefaults(config, defaultConfig$1);

      return {
          config,
          parent,
          get markers() {
              const cfg = resolveRef(this.config.markers);
              const markers = (mobx.isObservableArray(cfg)) ?
                  cfg.map(m => [m, true]) :
                  Object.entries(cfg);
              return new Map(markers);
          },
          get dimensions() {
              return mobx.toJS(this.config.dimensions);
          },
          has(d) {
              return this.markers.has(this.getKey(d));
          },
          any() {
              return this.markers.size !== 0;
          },
          getPayload(d) {
              return this.markers.get(this.getKey(d));
          },
          set: mobx.action("setFilter", function(d, payLoad = true) {
              if (Array.isArray(d)) d.forEach(this.set.bind(this));
              const key = this.getKey(d);
              this.config.markers = mapToObj(this.markers.set(key, payLoad));
          }),
          delete: mobx.action("deleteFilter", function(d) {
              if (Array.isArray(d)) d.forEach(this.delete.bind(this));
              const key = this.getKey(d);
              const success = this.markers.delete(key);
              this.config.markers = mapToObj(this.markers);
              return success;
          }),
          toggle: mobx.action("toggleFilter", function(d) {
              const key = this.getKey(d);
              const del = this.delete(key);
              if (!del) this.set(key);
              return !del;
          }),
          getKey(d) {
              return isString$1(d) ? d : d[Symbol.for('key')];
          },
          get whereClause() {
              let filter = {};

              // dimension filters
              const dimFilters = [];
              this.parent.space.forEach(dim => {
                  if (this.dimensions[dim]) {
                      dimFilters.push(this.dimensions[dim]);
                  }
              });

              // specific marker filters
              const markerFilters = [];
              for (let [key, payload] of this.markers) {
                  const markerSpace = Object.keys(key);
                  if (arrayEquals(markerSpace, this.parent.space)) {
                      markerFilters.push(key);
                  }
              }

              // combine dimension and marker filters
              if (markerFilters.length > 0) {
                  filter["$or"] = markerFilters;
                  if (dimFilters.length > 0) {
                      filter["$or"].push({ "$and": dimFilters });
                  }
              } else {
                  if (dimFilters.length > 0) {
                      // clean implicit $and
                      filter = deepmerge.all(dimFilters);
                  }
              }

              return filter;
          },
      }
  }

  const defaultConfig$2 = {
  };

  const defaults = {
      filter: null,
      constant: null,
      concept: undefined,
      space: null,
      value: null,
      filter: null,
      locale: null,
      source: null,
      domain: [0, 1],
      domainDataSource: 'auto'
  };

  function dataConfig(config = {}, parent) {

      applyDefaults(config, defaultConfig$2);
      let latestResponse = [];

      return {
          config,
          parent,
          get invariants() {
              let fails = [];
              if (this.constant && (this.concept || this.source)) fails.push("Can't have constant value and concept or source set.");
              if (this.conceptInSpace && this.source) fails.push("Can't have concept in space and have a source simultaneously");
              if (fails.length > 0)
                  console.warn("One or more invariants not satisfied:",fails,this);
          },
          get source() {
              mobx.trace();
              if (this.config.source)
                  return dataSourceStore.getByDefinition(this.config.source)
              else
                  return (this.parent.marker) ? this.parent.marker.data.source : null;
          },
          get space() {
              //trace();
              if(!this.parent.marker) // only markers do space autoconfig
                  return this.configSolution.space;
              return this.config.space || (this.parent.marker ? this.parent.marker.data.space : defaults.space)
          },
          get constant() {
              return resolveRef(this.config.constant) || defaults.constant;
          },
          isConstant() {
              return this.constant != null;
          },
          get commonSpace() {
              return intersect(this.space, this.parent.marker.data.space);
          },
          get filter() {
              const config = this.config.filter || (this.parent.marker ? this.parent.marker.data.config.filter : {});
              return mobx.observable(filter$1(config, this));
          },
          get locale() {
              if (this.config.locale)
                  return typeof this.config.locale == "string" ? this.config.locale : this.config.locale.id;
              else
                  return (this.parent.marker) ? this.parent.marker.data.locale : null;          
          },
          get concept() { 
              return this.parent.marker.data.configSolution.encodings[this.parent.name];
              // return this.config.concept ? resolveRef(this.config.concept) : defaults.concept; 
          },
          get conceptProps() { return this.source.getConcept(this.concept) },
          get availability() { return this.source.availability.data.map(kv => this.source.getConcept(kv.value)) },
          get domainDataSource() {
              let source = this.config.domainDataSource || defaults.domainDataSource;
              if (source === 'auto') {
                  source = this.conceptInSpace
                      ? 'filterRequired'
                      : 'self';
              }
              return source;
          },
          get domainData() {
              const source = this.domainDataSource;
              const data = source === 'self' ? this.responseMap
                  : this.parent.marker.transformedDataMaps.has(source) ? this.parent.marker.transformedDataMaps.get(source).get()
                  : source === 'markers' ? this.parent.marker.dataMap  
                  : this.responseMap;

              return data;
          },
          get domain() {
              mobx.trace();
              if (this.isConstant())
                  return isNumeric(this.constant) ? [this.constant, this.constant] : [this.constant];

              return this.calcDomain(this.domainData, this.conceptProps);
          },
          calcDomain(data, { concept, concept_type }) { 
              // use rows api implemented by both group and df
              if (["measure","time"].includes(concept_type)) // continuous
                  return extent(data.rows(), concept);
              else // ordinal (entity_set, entity_domain, string)
                  return unique(data.rows(), concept); 
          },


          /**
           * Finds a config which satisfies both marker.space and encoding.concept autoconfigs
           */
          get configSolution() {
              let encodings;
              let space = resolveRef(this.config.space);
          
              if (space && space.autoconfig) {
                  const availableSpaces = [...this.source.availability.keyLookup.values()];
                  const satisfiesSpaceAutoCfg = createFilterFn(this.config.space.autoconfig);

                  space = availableSpaces
                      .sort((a, b) => a.length - b.length) // smallest spaces first
                      .filter(space => !space.includes("concept") && space
                              .map(c => this.source.getConcept(c))
                              .every(satisfiesSpaceAutoCfg)
                      )
                      .find(space => this.resolveEncodingConcepts(space, this.parent.encoding));
              } 

              space = space || defaults.space;
              encodings = this.resolveEncodingConcepts(space, this.parent.encoding); 

              if (!space || !encodings)
                  console.warn("Could not resolve space or encoding concepts for marker.", this.parent, { space, encodings });

              return { space, encodings };
          },

          /**
           * Tries to find encoding concepts for a given space and encodings Map. Returns solution if it succeeds. Returns `undefined` if it fails.
           * @param {String[]} space 
           * @param {Map} encodings Map where keys are encoding names, values are encoding models
           * @returns {Solution|undefined} solution
           */
          resolveEncodingConcepts(space, encodings) {
              const concepts = {};
              const success = [...encodings].every(([name, enc]) => {
                  // only resolve concepts for encodings which use concept property
                  if (!enc.config.data.concept) {
                      concepts[name] = undefined;
                      return true;
                  }
                  const encConcept = enc.data.resolveEncodingConcept(concepts, space);
                  if (encConcept !== undefined) {
                      concepts[name] = encConcept;
                      return true;
                  }
                  return false;
              });
              return success ? concepts : undefined;
          },

          /**
           * Tries to find encoding concept for a given space, encoding and partial solution.  
           * Should be called with encoding.data as `this`. 
           * Returns concept id which satisfies encoding definition (incl autoconfig) and does not overlap with partial solution.
           * @param {*} solution object whose keys are encoding names and values concept ids, assigned to those encodings. 
           * @param {*} space 
           * @returns {string} concept id
           */
          resolveEncodingConcept(solution, space) {
              let concept = resolveRef(this.config.concept);

              if (concept && concept.autoconfig) {
                  const satisfiesAutoCfg = createFilterFn(this.config.concept.autoconfig);
                  const usedConcepts = d3.values(solution);
                  const spaceConcepts = space.map(c => this.source.getConcept(c));
                  const availability = this.source.availability;
      
                  const conceptsInThisSpace = [...availability.keyValueLookup.get(createKeyStr(space)).values()]
                      .map(kv => this.source.getConcept(kv.value))
                      // exclude the ones such as "is--country", they won't get resolved
                      .filter(c => c.concept.substr(0,4) !== "is--")
                      .concat(spaceConcepts);
            
                  concept = conceptsInThisSpace
                      .find(c => satisfiesAutoCfg(c) && !usedConcepts.includes(c.concept)) || {};
                  concept = concept.concept;
              }
              return concept || defaults.concept;    
          },
          get hasOwnData() {
              return this.source && this.concept && !this.conceptInSpace;
          },
          get promise() {
              mobx.trace();
              // can't use .then on source because its execution won't be tracked by mobx (b/c async)
              if (this.source.state === FULFILLED) {
                  if (this.hasOwnData)
                      return this.source.query(this.ddfQuery)
                  else   
                      return fromPromise(Promise.resolve());
              }
              // infinite pending, replaced when source is fulfilled
              return fromPromise(new Promise(() => {}));
          },
          get state() {
              return this.promise.state;
          },
          get response() {
              mobx.trace();
              if (!this.source || !this.concept || this.conceptInSpace) {
                  if (this.conceptInSpace)
                      console.warn("Encoding " + this.parent.name + " was asked for data but it has no own data. Reason: Concept in space.");
                  else
                      console.warn("Encoding " + this.parent.name + " was asked for data but it has no own data.");
              }
              return this.promise.case({
                  pending: () => latestResponse,
                  rejected: e => latestResponse,
                  fulfilled: (res) => latestResponse = res
              });
          },
          get responseMap() {
              mobx.trace();
              if (isDataFrame(this.response))
                  return this.response;
              else
                  return DataFrame(this.response, this.commonSpace);
          },
          get conceptInSpace() {
              return this.concept && this.space && this.space.includes(this.concept);
          },
          get ddfQuery() {
              const query = {};
              // select
              query.select = {
                  key: this.space.slice(), // slice to make sure it's a normal array (not mobx)
                  value: [this.concept]
              };

              // from
              query.from = (this.space.length === 1) ? "entities" : "datapoints";

              // where
              if (this.filter) {
                  query.where = this.filter.whereClause;
              }
            
              if (this.locale) {
                  query.language = this.locale; 
              }
            
              return query;
          },
      };
  }

  function entityPropertyDataConfig(cfg, parent) {
      const base = dataConfig(cfg, parent);

      return composeObj(base, {

          get promise() {
              mobx.trace();
              if (this.source.conceptsState !== "fulfilled") return fromPromise.resolve([]);
              const labelPromises = this.queries.map(query => this.source.query(query)
                  .then(data => ({ dim: query.select.key[0], data }))
              );
              return fromPromise(Promise.all(labelPromises));
          },
          get queries() {
              const entityDims = this.space.filter(dim => this.source.isEntityConcept(dim));
              return entityDims.map(dim => ({
                  select: {
                      key: [dim],
                      value: [this.concept]
                  },
                  from: "entities"
              }));
          },
          get lookups() {
              const concept = this.concept;
              const lookups = new Map();
              this.response.forEach(response => {
                  const { dim, data } = response;
                  const lookup = new Map();
                  lookups.set(dim, lookup);
                  data.forEach(row => {
                      lookup.set(row[dim], row[concept]);
                  });
              });
              return new Map([[this.concept, lookups]]);
          },
          get responseMap() {
              return DataFrame.fromLookups(this.lookups, this.commonSpace)
          },
          addLabels(markers, encName) {
              // reduce lookups
              const space = mobx.toJS(this.space);
              const lookups = this.lookups;
              markers.forEach((marker, key) => {
                  const label = {};
                  space.forEach(dim => {
                      if (lookups.has(dim))
                          label[dim] = lookups.get(dim).get(marker[dim]);
                      else
                          label[dim] = marker[dim];
                  });
                  marker[encName] = label;
              });
          }
      })
  }

  const dataConfigStore = createStore(dataConfig, {
      entityPropertyDataConfig,
  });

  const scales = {
      "linear": d3.scaleLinear,
      "log": d3.scaleLog,
      "sqrt": d3.scaleSqrt,
      "ordinal": d3.scaleOrdinal,
      "point": d3.scalePoint,
      "band": d3.scaleBand
  };


  const defaultConfig$3 = {
      domain: null,
      range: null,
      type: null
  };

  const defaults$1 = {
      domain: [0,1]
  };

  function baseScale(config = {}, parent) {

      applyDefaults(config, defaultConfig$3);

      return {
          config,
          parent,
          // ordinal, point or band
          ordinalScale: "ordinal",
          get data() {
              return this.parent.data;
          },
          get type() {
              const concept = this.data.conceptProps;
              let scaleType = null;
              let scale;
              if (scales[this.config.type])
                  scaleType = this.config.type;
              else if (concept && concept.scales && (scale = JSON.parse(concept.scales)[0]) && scales[scale])
                  scaleType = scale;
              else if (concept && ["entity_domain", "entity_set", "string"].includes(concept.concept_type))
                  scaleType = this.ordinalScale;
              else
                  scaleType = "linear";
              return scaleType;
          },
          get range() {
              if (this.config.range != null)
                  return this.config.range

              // default for constant is identity
              if (this.data.isConstant())
                  return this.domain;

              // default
              return (this.type == "ordinal") ?
                  d3.schemeCategory10 : [0, 1];
          },
          set range(range) {
              this.config.range = range;
          },
          get domain() {
              mobx.trace();
              return this.config.domain ? this.config.domain.map(c => parseConfigValue(c, this.data.conceptProps))
                  : this.data.domain ? this.data.domain
                  : defaults$1.domain;
          },
          clampToDomain(val) {
              const domain = this.domain;
              if (this.type == "ordinal" || this.type == "band" || this.type == "point")
                  return domain.includes(val) ? val : undefined;
              
              if (val < domain[0]) return domain[0];
              if (val > domain[1]) return domain[1];
              return val;
          },
          get d3Scale() {
              const scale = scales[this.type]();
              const domain = (this.type == "log" && this.domain[0] == 0) ? [1, this.domain[1]] : this.domain;
              return scale.range(this.range).domain(domain);
          },
      }
  }

  const defaultConfig$4 = {};

  const colors = {
      schemeCategory10: d3.schemeCategory10
  };

  function color(config, parent) {

      applyDefaults(config, defaultConfig$4);
      const s = baseScale(config, parent);

      return assign(s, {
          get range() {
              const range = this.config.range;
              if (Array.isArray(range))
                  return range;
              
              if (isString(range) && colors[range])
                  return colors[range];

              if (this.type == "ordinal")
                  return d3.schemeCategory10;

              return ["red", "green"];
          }
      });
  }

  const defaultConfig$5 = {
      type: "sqrt",
      range: [0, 20]
  };

  function size(config, parent) {

      applyDefaults(config, defaultConfig$5);
      const s = baseScale(config, parent);

      return assign(s, {
          ordinalScale: "point",
          get range() {
              if (this.config.range != null)
                  return this.config.range
              if (this.type == "point")
                  return [1, 20];
              return [0, 20];
          }
      });
  }

  const scaleStore = createStore(baseScale, {
      color,
      size,
  });

  //import { scaleLinear, scaleSqrt, scaleLog, scalePoint, scaleOrdinal, schemeCategory10, extent, set } from 'd3'

  const defaultConfig$6 = {
      scale: {},
      data: {}
  };

  const functions$1 = {
      get marker() {
          //trace();
          const marker = markerStore.getMarkerForEncoding(this);
          if (marker == null) console.warn("Couldn't find marker model for encoding.", { encoding: this });
          return marker;
      },
      get name() {
          return this.marker.getEncodingName(this);
      },
      get data() {
          return dataConfigStore.getByDefinition(this.config.data, this);
      },
      get scale() {
          return scaleStore.getByDefinition(this.config.scale, this);
      },
      setWhich: mobx.action('setWhich', function(kv) {
          const concept = this.data.source.getConcept(kv.value.concept);

          this.config.data.concept = concept.concept;
          this.config.data.space = kv.key;
          this.config.scale.domain = null;
          this.config.scale.type = null;
      }),
      get prop() {
          return this.marker.getPropForEncoding(this);
      }
  };

  function baseEncoding(config, parent) {
      applyDefaults(config, defaultConfig$6);
      console.log('creating new encoding', config);
      return assign({}, functions$1, configurable, { config, parent });
  }

  //import { interpolate, extent } from 'd3';

  const defaultConfig$7 = {
      modelType: "frame",
      value: null,
      scale: { modelType: "frame" },
  };

  const defaults$2 = {
      interpolate: true,
      loop: false,
      speed: 100,
      step: { unit: "index", size: 1 }
  };

  const functions$2 = {
      get value() {
          mobx.trace();
          let value;
          if (this.config.value != null) {
              value = parseConfigValue(this.config.value, this.data.conceptProps);
              value = this.scale.clampToDomain(value);
          } else {
              value = this.scale.domain[0];
          }
          return value; 
      },
      get index() {
          const value = this.value;
          return this.stepArray.findIndex(stepVal => equals(stepVal, value));
      },
      get stepArray() {
          return [...this.stepFn()];
      },
      get speed() { return this.config.speed || defaults$2.speed },
      get loop() { return this.config.loop || defaults$2.loop },
      get stepSize() { return this.config.step && this.config.step.size || defaults$2.step.size },
      get stepUnit() { return this.config.step && this.config.step.unit || this.getStepUnit() },
      getStepUnit() {
          if (this.data.state !== "fulfilled")
              return defaults$2.step.unit; // no concept information yet

          const { concept, concept_type } = this.data.conceptProps;
          if (concept_type == 'measure') 
              return 'number';

          if (['string','entity_domain','entity_set'].includes(concept_type)) 
              return 'index';

          if (concept_type == 'time') {
              if (['year', 'month','day','hour','minute','second'].includes(concept)) {
                  return concept;
              }
              if (concept == "time")
                  return "year";
          }
          return defaults$2.step.unit;
      },
      get interpolate() { return this.config.interpolate || defaults$2.interpolate },
      get stepFn() {
          return stepIterator(this.stepUnit, this.stepSize, this.scale.domain)
      },
      playing: false,
      nextValGen: null,
      togglePlaying() {
          this.playing ?
              this.stopPlaying() :
              this.startPlaying();
      },
      startPlaying: function() {
          if (equals(this.value, this.scale.domain[this.scale.domain.length-1]))
              this.setValue(this.scale.domain[0]);

          this.setPlaying(true);
      },
      stopPlaying: function() {
          this.setPlaying(false);
      },
      setPlaying: mobx.action('setPlaying', function(playing) {
          this.playing = playing;
      }),
      setSpeed: mobx.action('setSpeed', function(speed) {
          speed = Math.max(0, speed);
          this.config.speed = speed;
      }),
      setValue: mobx.action('setValue', function(value) {
          const concept = this.data.conceptProps;
          let date = value instanceof Date ? value : parseConfigValue(value, concept);
          const string = typeof value === "string" ? value : configValue(value, concept);
          if (date != null) {
              date = this.scale.clampToDomain(date);
          }
          this.config.value = string;
      }),
      setIndex: mobx.action('setIndex', function(idx) {
          this.setValue(this.stepArray[idx]);
      }),
      setValueAndStop: mobx.action('setValueAndStop', function(value) {
          this.stopPlaying();
          this.setValue(value);
      }),
      setIndexAndStop: mobx.action('setIndexAndStop', function(idx) {
          this.stopPlaying();
          this.setIndex(idx);
      }),
      update: mobx.action('update frame value', function() {
          if (this.playing && this.marker.state === FULFILLED) {
              const nxt = this.nextValGen.next();
              if (nxt.done) {
                  if (this.loop) {
                      this.setValue(this.scale.domain[0]);
                      this.nextValGen = this.stepFn();
                  } else {
                      this.stopPlaying();
                  }
              } else {
                  this.setValue(nxt.value);
              }
          }
      }),
      get transformationFns() {
          return {
              'currentFrame': this.currentFrame.bind(this),
              'frameMap': this.frameMap.bind(this)
          }
      },
      currentFrame(data) {
          if (data.has(this.frameKey)) {
              return data.get(this.frameKey);
          } else {
              console.warn("Frame value not found in frame map", this);
              return new Map();
          }
      },
      get frameKey() {
          return createMarkerKey({ [this.name]: this.value }, [this.name]);
      },
      get rowKeyDims() {
          // remove frame concept from key if it's in there
          // e.g. <geo,year>,pop => frame over year => <year>-><geo>,year,pop 
          return relativeComplement([this.data.concept], this.data.space);
      },
      frameMap(data) {
          if (this.interpolate) 
              data = this.interpolateData(data);
          return data.groupBy(this.name, this.rowKeyDims);
      },
      interpolateData(df) {
          const concept = this.data.concept;
          const name = this.name;
          const domain = this.data.calcDomain(df, this.data.conceptProps);
          const stepFn = stepIterator(this.stepUnit, this.stepSize, domain);

          return df
              .groupBy(this.rowKeyDims, [name])
              .map((group, groupKeyDims) => { 

                  const fillFns = {};
                  df.key.forEach(dim => {
                      // copy space values from group key
                      if (dim in groupKeyDims) 
                          fillFns[dim] = groupKeyDims[dim];
                      // frame concept not in group key so copy from row
                      if (dim === concept)
                          fillFns[dim] = row => row[name];  
                  });

                  return group
                      .reindex(stepFn)   // reindex also orders (needed for interpolation)
                      .fillNull(fillFns) // fill nulls of marker space with custom fns
                      .interpolate();    // fill rest of nulls through interpolation
              })
              .flatten(df.key);
      },
      setUpReactions() {
          // need reaction for timer as it has to set frame value
          // not allowed to call action (which changes state) from inside observable/computed, thus reaction needed
          const controlTimer = mobx.reaction(
              // mention all observables (state & computed) which you want to be tracked
              // if not tracked, they will always be recomputed, their values are not cached
              () => { return { playing: this.playing, speed: this.speed } },
              ({ playing, speed }) => {
                  clearInterval(this.playInterval);
                  if (playing) {
                      this.nextValGen = this.stepFn(this.value);
                      this.update();
                      this.playInterval = setInterval(this.update.bind(this), speed);
                  }
              }, 
              { name: "frame playback timer" }
          );
      }
  };

  function frame(config) {
      applyDefaults(config, defaultConfig$7);
      return assign(baseEncoding(config), functions$2);
  }

  const defaultConfig$8 = {
      modelType: "selection",
      data: {
          filter: {} // force own filter value so it doesn't fall back to marker filter like a normal encoding
      }
  };

  const functions$3 = {};

  const selection = defaultDecorator({
      base: baseEncoding,
      defaultConfig: defaultConfig$8,
      functions: functions$3
  });

  const directions$1 = {
      ascending: "ascending",
      descending: "descencding"
  };
  const defaults$3 = {
      direction: directions$1.ascending
  };

  const order$1 = defaultDecorator({
      base: baseEncoding,
      functions: {
          get direction() {
              return this.data.config.direction || defaults$3.direction;
          },
          order(df) {
              const name = this.name;
              const direction = this.direction;
              return df.order([{ [name]: direction }]);
          },
          get transformationFns() {
              return {
                  order: this.order.bind(this)
              }
          },
      }
  });

  const defaultConfig$9 = {
      starts: {},
      data: { filter: { markers: {} } }
  };

  const defaults$4 = {
      show: true,
      groupDim: null,
  };

  function trail(config, parent) {

      applyDefaults(config, defaultConfig$9);

      const base = baseEncoding(config, parent);

      return assign(base, {
          get show() { return this.config.show || defaults$4.show },
          get starts() {
              return this.config.starts;
          },
          get groupDim() {
              return resolveRef(this.config.groupDim) || defaults$4.groupDim;
          },
          updateTrailStart: mobx.action('update trail start', function(value) {
              this.data.filter.markers.forEach((payload, key) => {
                  const start = this.starts[key];
                  if (value < start)
                      this.config.starts[key] = value;
              });
          }),
          setTrail: mobx.action(function(d) {
              const key = this.getKey(d);
              this.config.starts[key] = d[this.groupDim]; // frame value
              this.data.filter.set(d);
          }),
          deleteTrail: mobx.action(function(d) {
              const key = this.getKey(d);
              delete this.config.starts[key]; // frame value
              this.data.filter.delete(d);
          }),
          getKey(d) {
              return isString$1(d) ? d : d[Symbol.for('key')];
          },
          get transformationFns() {
              return {
                  'addTrails': this.addTrails.bind(this)
              }
          },
          // per given marker, in whatever group
          //  1. get markers from groups before its group (possibly starting at given group)
          //  2. add those markers to current group, with key including original group (so no collission)
          //
          addTrails(groupedDf) {
              const frameMap = groupedDf;
              // can't use this.groupDim because circular dep this.marker.transformedDataMap
              const groupDim = groupedDf.key[0]; // supports only 1 dimensional grouping
              const markers = this.data.filter.markers;

              if (markers.size == 0)
                  return frameMap;

              // create trails
              const trails = new Map();
              for (let key of markers.keys()) {
                  const trail = new Map();
                  trails.set(key, trail);
                  for (let [i, frame] of frameMap) {
                      if (frame.hasByObjOrStr(null,key))
                          trail.set(i, frame.getByObjOrStr(null,key));
                  }
              }
              
              // add trails to frames
              const prop = groupDim;
              const newFrameMap = DataFrameGroupMap([], frameMap.key, frameMap.descendantKeys);
              const trailKeyDims = [...frameMap.descendantKeys[0], prop];
              for (let [id, frame] of frameMap) {
                  const newFrame = DataFrame([], frame.key);
                  for (let [markerKey, markerData] of frame) {
                      // insert trails before its head marker
                      if (trails.has(markerKey)) {
                          const trail = trails.get(markerKey);
                          const trailStart = this.starts[markerKey];
                          const trailEnd = markerData[prop];
                          // add trail markers in ascending order
                          for (let keyStr of groupedDf.keys()) {
                              const i = groupedDf.get(keyStr).values().next().value[prop];
                              //const i = parseMarkerKey(keyStr)[prop];
                              if (i < trailStart || !trail.has(keyStr)) continue;
                              if (i >= trailEnd) break;
                              const trailMarker = trail.get(keyStr);
                              const newKey = createMarkerKey(trailMarker, trailKeyDims);
                              const newData = Object.assign({}, trailMarker, {
                                  [Symbol.for('key')]: newKey,
                                  [Symbol.for('trailHeadKey')]: markerKey
                              });
                              newFrame.set(newData, newKey);
                          }
                      }
                      // (head) marker
                      newFrame.set(markerData, markerKey);
                  }
                  newFrameMap.set(id, newFrame);
              }
              return newFrameMap;
          }
      });
  }

  const encodingStore = createStore(baseEncoding, {
      frame,
      selection,
      order: order$1,
      trail
  });

  const defaultConfig$a = {
      data: {
          space: [],
          filter: {}
      },
      encoding: {},
  };

  const defaults$5 = {
      requiredEncodings: [],
      transformations: [
          "frame.frameMap",
          "filterRequired",
          "order.order",
          "trail.addTrails",
          "frame.currentFrame"
      ]
  };

  let functions$4 = {
      on: function(prop, fn) {
          if (this.validProp(prop) && typeof fn == "function") {
              const disposer = mobx.reaction(
                  () => this[prop], 
                  propVal => fn.call(this, propVal)
              );
              this.getEventListenersMapFor(prop).set(fn, disposer);
          }
          return this;
      },
      off: function(prop, fn) {
          if (this.validProp(prop) && this.eventListeners.get(prop).has(fn)){
              this.getEventListenersMapFor(prop).get(fn)(); // dispose
              this.getEventListenersMapFor(prop).delete(fn); // delete
          }
          return this;
      },
      validProp(prop) {
          return prop in this;
      },
      get eventListeners() {
          return new Map();
      },
      getEventListenersMapFor(prop) {
          if (!this.eventListeners.has(prop))
              this.eventListeners.set(prop, new Map());
          return this.eventListeners.get(prop);
      },
      get data() {
          return dataConfigStore.getByDefinition(this.config.data, this)
      },
      get requiredEncodings() { return this.config.requiredEncodings || defaults$5.requiredEncodings },
      get encoding() {
          mobx.trace();
          if (Object.keys(this.config.encoding).length > 0)
              return encodingStore.getByDefinitions(this.config.encoding, this);
          
          // get default encodings for data's data source
          let defaultEnc;
          if (defaultEnc = this.data.source.defaultEncoding)
              return encodingStore.getByDefinitions(defaultEnc, this);

          console.warn("No encoding found and marker data source has no default encodings");
      },
      // TODO: encodings should know the property they encode to themselves; not sure how to pass generically yet 
      getEncodingName(encoding) {
          for (let [name, enc] of this.encoding) {
              if (enc == encoding) return name;
          }
      },
      get state() {
          mobx.trace();
          const encodingStates= [...this.encoding.values()].map(enc => enc.data.state);
          const states = [this.data.source.state, ...encodingStates];
          return combineStates(states);
      },
      get availability() {
          const items = [];
          dataSourceStore.getAll().forEach(ds => {
              ds.availability.data.forEach(kv => {
                  items.push({ key: kv.key, value: ds.getConcept(kv.value), source: ds });
              });
          });
          return items;
      },
      get spaceAvailability() {
          const items = [];
          dataSourceStore.getAll().forEach(ds => {
              ds.availability.keyLookup.forEach((val, key) => {
                  items.push(val);
              });
          });
          return items;
      },
      // computed to cache calculation
      get dataMapCache() {
          mobx.trace();
          // prevent recalculating on each encoding data coming in
          if (this.state !== "fulfilled") 
              return DataFrame([], this.data.space);

          const markerDefiningEncodings = [];
          const markerAmmendingEncodings = [];
          const spaceEncodings = [];
          const constantEncodings = [];

          // sort visual encodings by how they add data to markers
          for (let [name, encoding] of this.encoding) {

              // no data or constant, no further processing (e.g. selections)
              if (encoding.data.concept === undefined && !encoding.data.isConstant())
                  continue;

              // constants value (ignores other config like concept etc)
              else if (encoding.data.isConstant())
                  constantEncodings.push({ name, encoding });

              // copy data from space/key
              else if (encoding.data.conceptInSpace)
                  spaceEncodings.push({ name, encoding });
              
              // own data, not defining final markers (not required or proper subspace)
              else if (isProperSubset(encoding.data.space, this.data.space) || !this.isRequired(name))
                  markerAmmendingEncodings.push(this.joinConfig(encoding, name));

              // own data, superspace (includes identical space) and required defining markers
              else
                  markerDefiningEncodings.push(this.joinConfig(encoding, name));    

          }

          // define markers (full join encoding data)
          let dataMap = fullJoin(markerDefiningEncodings, this.data.space);
          // ammend markers with non-defining data, constants and copies of space
          dataMap = dataMap.leftJoin(markerAmmendingEncodings);
          constantEncodings.forEach(({name, encoding}) => {
              dataMap = dataMap.addColumn(name, encoding.data.constant);
          });
          spaceEncodings.forEach(({name, encoding}) => {
              const concept = encoding.data.concept;
              dataMap = dataMap.addColumn(name, row => row[concept]);
          });

          return dataMap;
      },
      joinConfig(encoding, name) {
          return { 
              projection: { 
                  [encoding.data.concept]: name
              },
              dataFrame: encoding.data.responseMap
          }
      },
      isRequired(name) {
          return this.requiredEncodings.length === 0 || this.requiredEncodings.includes(name)
      },
      filterRequired(data) {
          const required = this.requiredEncodings;
          return data
              .filter(row => required.every(encName => row.hasOwnProperty(encName) && row[encName] !== null))
              .filterGroups(group => group.size > 0);
      },
      /**
       * transformationFns is an object 
       *  whose keys are transformation strings
       *  whose values are transformation functions
       */
      get transformationFns() {
          // marker transformation
          const transformations = {
              "filterRequired": this.filterRequired.bind(this)
          };
          // encoding transformations
          for (let [name, enc] of this.encoding) {
              if (enc.transformationFns)
                  for (let [tName, t] of Object.entries(enc.transformationFns))
                      transformations[name + '.' + tName] = t;
          }
          return transformations;
      },
      /**
       * Transformations is an array of strings, referring to transformations defined on the marker or encodings
       * The array defines the order in which data will be transformed before being served.
       * If a function reference cannot be resolved, it will be skipped. No error will be thrown.
       * Encoding transformations are formatted "<encodingName>.<functionName>". E.g. "frame.currentFrame"
       * Marker transformations are formatted "<functionName>". E.g. "filterRequired"
       * This array of strings enables configuration of transformation order in a serializable format.
       */
      get transformations() {
          const transformations = this.config.transformations || defaults$5.transformations;

          return transformations
              .filter(tStr => tStr in this.transformationFns)
              .map(tStr => ({
                      fn: this.transformationFns[tStr],
                      name: tStr
              }));
      },
      /**
       * transformedDataMaps is a ES6 Map
       *  whose keys are transformation strings or "final" and
       *  whose values are DataFrames wrapped in a boxed mobx computed. 
       *      The DataFrame is a result of the transformation function applied to the previous DataFrame.  
       */
      // currently all transformation steps are cached in computed values. Computeds are great to prevent recalculations
      // of previous steps when config of one step changes. However, it uses memory. We might want this more configurable.
      get transformedDataMaps() {
          mobx.trace();
          // returns boxed computed, whose value can be reached by .get()
          // if we'd call .get() in here (returning the value), each change would lead to applying all transformations
          // because transformedDataMaps() would be observering all stepResults
          // would be nice to find a way for transformedDataMaps to just return the value instead of a boxed computed
          const results = new Map();
          let stepResult = mobx.observable.box(this.dataMapCache, { deep: false });
          this.transformations.forEach(({name, fn}) => {
              let prevResult = stepResult; // local reference for closure of computed
              stepResult = mobx.computed(
                  () => fn(prevResult.get()), 
                  { name }
              );
              results.set(name, stepResult);
          });
          results.set('final', stepResult);
          return results;
      },
      /**
       * Helper function to get values from transformedDataMaps. Used to prevent the awkward `.get(name).get()` syntax.
       */
      getTransformedDataMap(name) {
          if (this.transformedDataMaps.has(name))
              return this.transformedDataMaps.get(name).get();
          console.warn("Requesting unknown transformed data name: ", name);
      },
      get dataMap() {
          return this.transformedDataMaps.get('final').get();
      },
      get dataArray() {
          return this.dataMap.toJSON();
      }
  };

  function baseMarker(config) {
      applyDefaults(config, defaultConfig$a);
      return assign({}, functions$4, configurable, { config });
  }

  const defaultConfig$b = {
      requiredEncodings: ["x", "y", "size"],
      encoding: {
          size: { scale: { modelType: "size" } }
      }
  };

  function bubble(config) {
      const base = baseMarker(config);

      applyDefaults(config, defaultConfig$b);
      renameProperty(base, "encoding", "superEncoding");

      return assign(base, {
          get encoding() {
              const enc = this.superEncoding;
              enc.set('highlighted', encodingStore.getByDefinition({ modelType: "selection" }));
              enc.set('superhighlighted', encodingStore.getByDefinition({ modelType: "selection" }));
              return enc;
          },
          toggleSelection: mobx.action(function(d) {
              const trails = this.encoding.get('trail');
              if (!trails.data.filter.has(d)) {
                  trails.setTrail(d);
              } else {
                  trails.deleteTrail(d);
              }
          })
      })

  }

  bubble.decorate = baseMarker.decorate;

  const markerStore = createStore(baseMarker, { bubble });
  markerStore.getMarkerForEncoding = function(enc) {
      return this.getAll().find(marker => {
          return [...marker.encoding.values()].some(encoding => enc === encoding);
      }) || null;
  };

  const stores = {
      markers: markerStore,
      dataSources: dataSourceStore,
      encodings: encodingStore
  };

  let config;

  const vizabi = function(cfg) {
      config = mobx.observable(cfg);

      dataSourceStore.setMany(config.dataSources || {});
      encodingStore.setMany(config.encodings || {});
      markerStore.setMany(config.markers || {});

      return { stores, config };
  };
  vizabi.mobx = mobx;
  vizabi.utils = utils;
  vizabi.stores = stores;
  vizabi.dataSource = (cfg, id) =>{
      // shortcut giving data directly in array-object format: [{...},{...}]
      if (Array.isArray(cfg)) {
          cfg = {
              values: cfg
          };
      }

      return dataSourceStore.set(cfg, id);
  }; 
  vizabi.marker = (cfg, id) => {
      cfg = mobx.observable(cfg);
      return markerStore.set(cfg, id);
  };

  /**
   * 
   * @param {*} possibleRef 
   * @returns config Config object as described in reference config
   */
  function resolveRef(possibleRef) {
      // no ref
      if (!possibleRef || typeof possibleRef.ref === "undefined")
          return possibleRef

      // handle config shorthand
      let ref = (isString$1(possibleRef.ref)) ? { config: possibleRef.ref } : possibleRef.ref;

      // invalid ref
      if (!(ref.config || ref.model)) {
          console.warn("Invalid reference, expected string reference in ref, ref.model or ref.config", possibleRef);
      }

      if (ref.config) {
          // user set config only
          return resolveTreeRef(ref.config, config);
      } else {
          // model ref includes resolved defaults
          const model = resolveTreeRef(ref.model, stores);
          return transformModel(model, ref.transform);
      }
  }

  function resolveTreeRef(refStr, tree) {
      const ref = refStr.split('.');
      let node = tree;
      for (let i = 0; i < ref.length; i++) {
          let child = ref[i];
          if (typeof node == "undefined") {
              console.warn("Couldn't resolve reference " + refStr);
              return null;
          }
          if (typeof node.get == "function")
              node = node.get(child);
          else
              node = node[child];
      }
      return node;
  }

  function transformModel(model, transform) {
      switch (transform) {
          case "entityConcept":
              return mobx.observable({
                  space: [model.data.concept],
                  filter: {
                      dimensions: {
                          [model.data.concept]: {
                              [model.data.concept]: { $in: model.scale.domain }
                          }
                      }
                  },
                  source: "gap"
              });
      }
  }

  return vizabi;

})));
//# sourceMappingURL=Vizabi.js.map
