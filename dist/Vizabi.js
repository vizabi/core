// http://vizabi.org v1.0.1 Copyright 2020 undefined
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
   *   \@observable.ref searchResults
   *
   *   componentDidUpdate(nextProps) {
   *     if (nextProps.query !== this.props.query)
   *       this.searchResults = fromPromise(
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
   * @param {IThenable<T>} oldPromise? The previously observed promise
   * @returns {IPromiseBasedObservable<T>}
   */
  function fromPromise(origPromise, oldPromise) {
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
      var oldData = oldPromise && oldPromise.state === FULFILLED
          ? oldPromise.value
          : undefined;
      mobx.extendObservable(promise, {
          value: oldData,
          state: PENDING,
      }, {}, { deep: false });
      return promise;
  }
  (function (fromPromise) {
      fromPromise.reject = mobx.action("fromPromise.reject", function (reason) {
          var p = fromPromise(Promise.reject(reason));
          p.state = REJECTED;
          p.value = reason;
          return p;
      });
      function resolveBase(value) {
          if (value === void 0) { value = undefined; }
          var p = fromPromise(Promise.resolve(value));
          p.state = FULFILLED;
          p.value = value;
          return p;
      }
      fromPromise.resolve = mobx.action("fromPromise.resolve", resolveBase);
  })(fromPromise || (fromPromise = {}));

  var __decorate =  function (decorators, target, key, desc) {
      var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
      if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
      else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
      return c > 3 && r && Object.defineProperty(target, key, r), r;
  };
  var StreamListener = /** @class */ (function () {
      function StreamListener(observable, initialValue) {
          var _this = this;
          mobx.runInAction(function () {
              _this.current = initialValue;
              _this.subscription = observable.subscribe(_this);
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
          enumerable: false,
          configurable: true
      });
      Object.defineProperty(ViewModel.prototype, "changedValues", {
          get: function () {
              return this.localValues.toJS();
          },
          enumerable: false,
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

  var __extends =  (function () {
      var extendStatics = function (d, b) {
          extendStatics = Object.setPrototypeOf ||
              ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
              function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
          return extendStatics(d, b);
      };
      return function (d, b) {
          extendStatics(d, b);
          function __() { this.constructor = d; }
          d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
      };
  })();
  /**
   * Reactively sorts a base observable array into multiple observable arrays based on the value of a
   * `groupBy: (item: T) => G` function.
   *
   * This observes the individual computed groupBy values and only updates the source and dest arrays
   * when there is an actual change, so this is far more efficient than, for example
   * `base.filter(i => groupBy(i) === 'we')`. Call #dispose() to stop tracking.
   *
   * No guarantees are made about the order of items in the grouped arrays.
   *
   * The resulting map of arrays is read-only. clear(), set(), delete() are not supported and
   * modifying the group arrays will lead to undefined behavior.
   *
   * @param {array} base The array to sort into groups.
   * @param {function} groupBy The function used for grouping.
   * @param options Object with properties:
   *  `name`: Debug name of this ObservableGroupMap.
   *  `keyToName`: Function to create the debug names of the observable group arrays.
   *
   * @example
   * const slices = observable([
   *     { day: "mo", hours: 12 },
   *     { day: "tu", hours: 2 },
   * ])
   * const slicesByDay = new ObservableGroupMap(slices, (slice) => slice.day)
   * autorun(() => console.log(
   *     slicesByDay.get("mo")?.length ?? 0,
   *     slicesByDay.get("we"))) // outputs 1, undefined
   * slices[0].day = "we" // outputs 0, [{ day: "we", hours: 12 }]
   */
  var ObservableGroupMap = /** @class */ (function (_super) {
      __extends(ObservableGroupMap, _super);
      function ObservableGroupMap(base, groupBy, _a) {
          var _b = _a === void 0 ? {} : _a, _c = _b.name, name = _c === void 0 ? "ogm" + ((Math.random() * 1000) | 0) : _c, _d = _b.keyToName, keyToName = _d === void 0 ? function (x) { return "" + x; } : _d;
          var _this = _super.call(this) || this;
          _this._keyToName = keyToName;
          _this._groupBy = groupBy;
          _this._ogmInfoKey = ("function" == typeof Symbol
              ? Symbol("ogmInfo" + name)
              : "__ogmInfo" + name);
          _this._base = base;
          for (var i = 0; i < base.length; i++) {
              _this._addItem(base[i]);
          }
          _this._disposeBaseObserver = mobx.observe(_this._base, function (change) {
              if ("splice" === change.type) {
                  mobx.transaction(function () {
                      for (var _i = 0, _a = change.removed; _i < _a.length; _i++) {
                          var removed = _a[_i];
                          _this._removeItem(removed);
                      }
                      for (var _b = 0, _c = change.added; _b < _c.length; _b++) {
                          var added = _c[_b];
                          _this._addItem(added);
                      }
                  });
              }
              else if ("update" === change.type) {
                  mobx.transaction(function () {
                      _this._removeItem(change.oldValue);
                      _this._addItem(change.newValue);
                  });
              }
              else {
                  throw new Error("illegal state");
              }
          });
          return _this;
      }
      ObservableGroupMap.prototype.clear = function () {
          throw new Error("not supported");
      };
      ObservableGroupMap.prototype.delete = function (_key) {
          throw new Error("not supported");
      };
      ObservableGroupMap.prototype.set = function (_key, _value) {
          throw new Error("not supported");
      };
      /**
       * Disposes all observers created during construction and removes state added to base array
       * items.
       */
      ObservableGroupMap.prototype.dispose = function () {
          this._disposeBaseObserver();
          for (var i = 0; i < this._base.length; i++) {
              var item = this._base[i];
              var grouperItemInfo = item[this._ogmInfoKey];
              grouperItemInfo.reaction();
              delete item[this._ogmInfoKey];
          }
      };
      ObservableGroupMap.prototype._getGroupArr = function (key) {
          var result = _super.prototype.get.call(this, key);
          if (undefined === result) {
              result = mobx.observable([], { name: "GroupArray[" + this._keyToName(key) + "]" });
              _super.prototype.set.call(this, key, result);
          }
          return result;
      };
      ObservableGroupMap.prototype._removeFromGroupArr = function (key, itemIndex) {
          var arr = _super.prototype.get.call(this, key);
          if (1 === arr.length) {
              _super.prototype.delete.call(this, key);
          }
          else if (itemIndex === arr.length - 1) {
              // last position in array
              arr.length--;
          }
          else {
              arr[itemIndex] = arr[arr.length - 1];
              arr[itemIndex][this._ogmInfoKey].groupArrIndex = itemIndex;
              arr.length--;
          }
      };
      ObservableGroupMap.prototype._addItem = function (item) {
          var _this = this;
          var groupByValue = this._groupBy(item);
          var groupArr = this._getGroupArr(groupByValue);
          var value = {
              groupByValue: groupByValue,
              groupArrIndex: groupArr.length,
              reaction: mobx.reaction(function () { return _this._groupBy(item); }, function (newGroupByValue, _r) {
                  console.log("new group by value ", newGroupByValue);
                  var grouperItemInfo = item[_this._ogmInfoKey];
                  _this._removeFromGroupArr(grouperItemInfo.groupByValue, grouperItemInfo.groupArrIndex);
                  var newGroupArr = _this._getGroupArr(newGroupByValue);
                  var newGroupArrIndex = newGroupArr.length;
                  newGroupArr.push(item);
                  grouperItemInfo.groupByValue = newGroupByValue;
                  grouperItemInfo.groupArrIndex = newGroupArrIndex;
              }),
          };
          Object.defineProperty(item, this._ogmInfoKey, {
              configurable: true,
              enumerable: false,
              value: value,
          });
          groupArr.push(item);
      };
      ObservableGroupMap.prototype._removeItem = function (item) {
          var grouperItemInfo = item[this._ogmInfoKey];
          this._removeFromGroupArr(grouperItemInfo.groupByValue, grouperItemInfo.groupArrIndex);
          grouperItemInfo.reaction();
          delete item[this._ogmInfoKey];
      };
      return ObservableGroupMap;
  }(mobx.ObservableMap));
  {
      if (typeof queueMicrotask !== "undefined") ;
      else if (typeof process !== "undefined" && process.nextTick) ;
  }

  var t0 = new Date,
      t1 = new Date;

  function newInterval(floori, offseti, count, field) {

    function interval(date) {
      return floori(date = arguments.length === 0 ? new Date : new Date(+date)), date;
    }

    interval.floor = function(date) {
      return floori(date = new Date(+date)), date;
    };

    interval.ceil = function(date) {
      return floori(date = new Date(date - 1)), offseti(date, 1), floori(date), date;
    };

    interval.round = function(date) {
      var d0 = interval(date),
          d1 = interval.ceil(date);
      return date - d0 < d1 - date ? d0 : d1;
    };

    interval.offset = function(date, step) {
      return offseti(date = new Date(+date), step == null ? 1 : Math.floor(step)), date;
    };

    interval.range = function(start, stop, step) {
      var range = [], previous;
      start = interval.ceil(start);
      step = step == null ? 1 : Math.floor(step);
      if (!(start < stop) || !(step > 0)) return range; // also handles Invalid Date
      do range.push(previous = new Date(+start)), offseti(start, step), floori(start);
      while (previous < start && start < stop);
      return range;
    };

    interval.filter = function(test) {
      return newInterval(function(date) {
        if (date >= date) while (floori(date), !test(date)) date.setTime(date - 1);
      }, function(date, step) {
        if (date >= date) {
          if (step < 0) while (++step <= 0) {
            while (offseti(date, -1), !test(date)) {} // eslint-disable-line no-empty
          } else while (--step >= 0) {
            while (offseti(date, +1), !test(date)) {} // eslint-disable-line no-empty
          }
        }
      });
    };

    if (count) {
      interval.count = function(start, end) {
        t0.setTime(+start), t1.setTime(+end);
        floori(t0), floori(t1);
        return Math.floor(count(t0, t1));
      };

      interval.every = function(step) {
        step = Math.floor(step);
        return !isFinite(step) || !(step > 0) ? null
            : !(step > 1) ? interval
            : interval.filter(field
                ? function(d) { return field(d) % step === 0; }
                : function(d) { return interval.count(0, d) % step === 0; });
      };
    }

    return interval;
  }

  var durationMinute = 6e4;
  var durationDay = 864e5;
  var durationWeek = 6048e5;

  var day = newInterval(function(date) {
    date.setHours(0, 0, 0, 0);
  }, function(date, step) {
    date.setDate(date.getDate() + step);
  }, function(start, end) {
    return (end - start - (end.getTimezoneOffset() - start.getTimezoneOffset()) * durationMinute) / durationDay;
  }, function(date) {
    return date.getDate() - 1;
  });

  function weekday(i) {
    return newInterval(function(date) {
      date.setDate(date.getDate() - (date.getDay() + 7 - i) % 7);
      date.setHours(0, 0, 0, 0);
    }, function(date, step) {
      date.setDate(date.getDate() + step * 7);
    }, function(start, end) {
      return (end - start - (end.getTimezoneOffset() - start.getTimezoneOffset()) * durationMinute) / durationWeek;
    });
  }

  var sunday = weekday(0);
  var monday = weekday(1);
  var tuesday = weekday(2);
  var wednesday = weekday(3);
  var thursday = weekday(4);
  var friday = weekday(5);
  var saturday = weekday(6);

  var year = newInterval(function(date) {
    date.setMonth(0, 1);
    date.setHours(0, 0, 0, 0);
  }, function(date, step) {
    date.setFullYear(date.getFullYear() + step);
  }, function(start, end) {
    return end.getFullYear() - start.getFullYear();
  }, function(date) {
    return date.getFullYear();
  });

  // An optimized implementation for this simple case.
  year.every = function(k) {
    return !isFinite(k = Math.floor(k)) || !(k > 0) ? null : newInterval(function(date) {
      date.setFullYear(Math.floor(date.getFullYear() / k) * k);
      date.setMonth(0, 1);
      date.setHours(0, 0, 0, 0);
    }, function(date, step) {
      date.setFullYear(date.getFullYear() + step * k);
    });
  };

  var utcDay = newInterval(function(date) {
    date.setUTCHours(0, 0, 0, 0);
  }, function(date, step) {
    date.setUTCDate(date.getUTCDate() + step);
  }, function(start, end) {
    return (end - start) / durationDay;
  }, function(date) {
    return date.getUTCDate() - 1;
  });

  function utcWeekday(i) {
    return newInterval(function(date) {
      date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 7 - i) % 7);
      date.setUTCHours(0, 0, 0, 0);
    }, function(date, step) {
      date.setUTCDate(date.getUTCDate() + step * 7);
    }, function(start, end) {
      return (end - start) / durationWeek;
    });
  }

  var utcSunday = utcWeekday(0);
  var utcMonday = utcWeekday(1);
  var utcTuesday = utcWeekday(2);
  var utcWednesday = utcWeekday(3);
  var utcThursday = utcWeekday(4);
  var utcFriday = utcWeekday(5);
  var utcSaturday = utcWeekday(6);

  var utcYear = newInterval(function(date) {
    date.setUTCMonth(0, 1);
    date.setUTCHours(0, 0, 0, 0);
  }, function(date, step) {
    date.setUTCFullYear(date.getUTCFullYear() + step);
  }, function(start, end) {
    return end.getUTCFullYear() - start.getUTCFullYear();
  }, function(date) {
    return date.getUTCFullYear();
  });

  // An optimized implementation for this simple case.
  utcYear.every = function(k) {
    return !isFinite(k = Math.floor(k)) || !(k > 0) ? null : newInterval(function(date) {
      date.setUTCFullYear(Math.floor(date.getUTCFullYear() / k) * k);
      date.setUTCMonth(0, 1);
      date.setUTCHours(0, 0, 0, 0);
    }, function(date, step) {
      date.setUTCFullYear(date.getUTCFullYear() + step * k);
    });
  };

  function localDate(d) {
    if (0 <= d.y && d.y < 100) {
      var date = new Date(-1, d.m, d.d, d.H, d.M, d.S, d.L);
      date.setFullYear(d.y);
      return date;
    }
    return new Date(d.y, d.m, d.d, d.H, d.M, d.S, d.L);
  }

  function utcDate(d) {
    if (0 <= d.y && d.y < 100) {
      var date = new Date(Date.UTC(-1, d.m, d.d, d.H, d.M, d.S, d.L));
      date.setUTCFullYear(d.y);
      return date;
    }
    return new Date(Date.UTC(d.y, d.m, d.d, d.H, d.M, d.S, d.L));
  }

  function newDate(y, m, d) {
    return {y: y, m: m, d: d, H: 0, M: 0, S: 0, L: 0};
  }

  function formatLocale(locale) {
    var locale_dateTime = locale.dateTime,
        locale_date = locale.date,
        locale_time = locale.time,
        locale_periods = locale.periods,
        locale_weekdays = locale.days,
        locale_shortWeekdays = locale.shortDays,
        locale_months = locale.months,
        locale_shortMonths = locale.shortMonths;

    var periodRe = formatRe(locale_periods),
        periodLookup = formatLookup(locale_periods),
        weekdayRe = formatRe(locale_weekdays),
        weekdayLookup = formatLookup(locale_weekdays),
        shortWeekdayRe = formatRe(locale_shortWeekdays),
        shortWeekdayLookup = formatLookup(locale_shortWeekdays),
        monthRe = formatRe(locale_months),
        monthLookup = formatLookup(locale_months),
        shortMonthRe = formatRe(locale_shortMonths),
        shortMonthLookup = formatLookup(locale_shortMonths);

    var formats = {
      "a": formatShortWeekday,
      "A": formatWeekday,
      "b": formatShortMonth,
      "B": formatMonth,
      "c": null,
      "d": formatDayOfMonth,
      "e": formatDayOfMonth,
      "f": formatMicroseconds,
      "g": formatYearISO,
      "G": formatFullYearISO,
      "H": formatHour24,
      "I": formatHour12,
      "j": formatDayOfYear,
      "L": formatMilliseconds,
      "m": formatMonthNumber,
      "M": formatMinutes,
      "p": formatPeriod,
      "q": formatQuarter,
      "Q": formatUnixTimestamp,
      "s": formatUnixTimestampSeconds,
      "S": formatSeconds,
      "u": formatWeekdayNumberMonday,
      "U": formatWeekNumberSunday,
      "V": formatWeekNumberISO,
      "w": formatWeekdayNumberSunday,
      "W": formatWeekNumberMonday,
      "x": null,
      "X": null,
      "y": formatYear,
      "Y": formatFullYear,
      "Z": formatZone,
      "%": formatLiteralPercent
    };

    var utcFormats = {
      "a": formatUTCShortWeekday,
      "A": formatUTCWeekday,
      "b": formatUTCShortMonth,
      "B": formatUTCMonth,
      "c": null,
      "d": formatUTCDayOfMonth,
      "e": formatUTCDayOfMonth,
      "f": formatUTCMicroseconds,
      "g": formatUTCYearISO,
      "G": formatUTCFullYearISO,
      "H": formatUTCHour24,
      "I": formatUTCHour12,
      "j": formatUTCDayOfYear,
      "L": formatUTCMilliseconds,
      "m": formatUTCMonthNumber,
      "M": formatUTCMinutes,
      "p": formatUTCPeriod,
      "q": formatUTCQuarter,
      "Q": formatUnixTimestamp,
      "s": formatUnixTimestampSeconds,
      "S": formatUTCSeconds,
      "u": formatUTCWeekdayNumberMonday,
      "U": formatUTCWeekNumberSunday,
      "V": formatUTCWeekNumberISO,
      "w": formatUTCWeekdayNumberSunday,
      "W": formatUTCWeekNumberMonday,
      "x": null,
      "X": null,
      "y": formatUTCYear,
      "Y": formatUTCFullYear,
      "Z": formatUTCZone,
      "%": formatLiteralPercent
    };

    var parses = {
      "a": parseShortWeekday,
      "A": parseWeekday,
      "b": parseShortMonth,
      "B": parseMonth,
      "c": parseLocaleDateTime,
      "d": parseDayOfMonth,
      "e": parseDayOfMonth,
      "f": parseMicroseconds,
      "g": parseYear,
      "G": parseFullYear,
      "H": parseHour24,
      "I": parseHour24,
      "j": parseDayOfYear,
      "L": parseMilliseconds,
      "m": parseMonthNumber,
      "M": parseMinutes,
      "p": parsePeriod,
      "q": parseQuarter,
      "Q": parseUnixTimestamp,
      "s": parseUnixTimestampSeconds,
      "S": parseSeconds,
      "u": parseWeekdayNumberMonday,
      "U": parseWeekNumberSunday,
      "V": parseWeekNumberISO,
      "w": parseWeekdayNumberSunday,
      "W": parseWeekNumberMonday,
      "x": parseLocaleDate,
      "X": parseLocaleTime,
      "y": parseYear,
      "Y": parseFullYear,
      "Z": parseZone,
      "%": parseLiteralPercent
    };

    // These recursive directive definitions must be deferred.
    formats.x = newFormat(locale_date, formats);
    formats.X = newFormat(locale_time, formats);
    formats.c = newFormat(locale_dateTime, formats);
    utcFormats.x = newFormat(locale_date, utcFormats);
    utcFormats.X = newFormat(locale_time, utcFormats);
    utcFormats.c = newFormat(locale_dateTime, utcFormats);

    function newFormat(specifier, formats) {
      return function(date) {
        var string = [],
            i = -1,
            j = 0,
            n = specifier.length,
            c,
            pad,
            format;

        if (!(date instanceof Date)) date = new Date(+date);

        while (++i < n) {
          if (specifier.charCodeAt(i) === 37) {
            string.push(specifier.slice(j, i));
            if ((pad = pads[c = specifier.charAt(++i)]) != null) c = specifier.charAt(++i);
            else pad = c === "e" ? " " : "0";
            if (format = formats[c]) c = format(date, pad);
            string.push(c);
            j = i + 1;
          }
        }

        string.push(specifier.slice(j, i));
        return string.join("");
      };
    }

    function newParse(specifier, Z) {
      return function(string) {
        var d = newDate(1900, undefined, 1),
            i = parseSpecifier(d, specifier, string += "", 0),
            week, day$1;
        if (i != string.length) return null;

        // If a UNIX timestamp is specified, return it.
        if ("Q" in d) return new Date(d.Q);
        if ("s" in d) return new Date(d.s * 1000 + ("L" in d ? d.L : 0));

        // If this is utcParse, never use the local timezone.
        if (Z && !("Z" in d)) d.Z = 0;

        // The am-pm flag is 0 for AM, and 1 for PM.
        if ("p" in d) d.H = d.H % 12 + d.p * 12;

        // If the month was not specified, inherit from the quarter.
        if (d.m === undefined) d.m = "q" in d ? d.q : 0;

        // Convert day-of-week and week-of-year to day-of-year.
        if ("V" in d) {
          if (d.V < 1 || d.V > 53) return null;
          if (!("w" in d)) d.w = 1;
          if ("Z" in d) {
            week = utcDate(newDate(d.y, 0, 1)), day$1 = week.getUTCDay();
            week = day$1 > 4 || day$1 === 0 ? utcMonday.ceil(week) : utcMonday(week);
            week = utcDay.offset(week, (d.V - 1) * 7);
            d.y = week.getUTCFullYear();
            d.m = week.getUTCMonth();
            d.d = week.getUTCDate() + (d.w + 6) % 7;
          } else {
            week = localDate(newDate(d.y, 0, 1)), day$1 = week.getDay();
            week = day$1 > 4 || day$1 === 0 ? monday.ceil(week) : monday(week);
            week = day.offset(week, (d.V - 1) * 7);
            d.y = week.getFullYear();
            d.m = week.getMonth();
            d.d = week.getDate() + (d.w + 6) % 7;
          }
        } else if ("W" in d || "U" in d) {
          if (!("w" in d)) d.w = "u" in d ? d.u % 7 : "W" in d ? 1 : 0;
          day$1 = "Z" in d ? utcDate(newDate(d.y, 0, 1)).getUTCDay() : localDate(newDate(d.y, 0, 1)).getDay();
          d.m = 0;
          d.d = "W" in d ? (d.w + 6) % 7 + d.W * 7 - (day$1 + 5) % 7 : d.w + d.U * 7 - (day$1 + 6) % 7;
        }

        // If a time zone is specified, all fields are interpreted as UTC and then
        // offset according to the specified time zone.
        if ("Z" in d) {
          d.H += d.Z / 100 | 0;
          d.M += d.Z % 100;
          return utcDate(d);
        }

        // Otherwise, all fields are in local time.
        return localDate(d);
      };
    }

    function parseSpecifier(d, specifier, string, j) {
      var i = 0,
          n = specifier.length,
          m = string.length,
          c,
          parse;

      while (i < n) {
        if (j >= m) return -1;
        c = specifier.charCodeAt(i++);
        if (c === 37) {
          c = specifier.charAt(i++);
          parse = parses[c in pads ? specifier.charAt(i++) : c];
          if (!parse || ((j = parse(d, string, j)) < 0)) return -1;
        } else if (c != string.charCodeAt(j++)) {
          return -1;
        }
      }

      return j;
    }

    function parsePeriod(d, string, i) {
      var n = periodRe.exec(string.slice(i));
      return n ? (d.p = periodLookup[n[0].toLowerCase()], i + n[0].length) : -1;
    }

    function parseShortWeekday(d, string, i) {
      var n = shortWeekdayRe.exec(string.slice(i));
      return n ? (d.w = shortWeekdayLookup[n[0].toLowerCase()], i + n[0].length) : -1;
    }

    function parseWeekday(d, string, i) {
      var n = weekdayRe.exec(string.slice(i));
      return n ? (d.w = weekdayLookup[n[0].toLowerCase()], i + n[0].length) : -1;
    }

    function parseShortMonth(d, string, i) {
      var n = shortMonthRe.exec(string.slice(i));
      return n ? (d.m = shortMonthLookup[n[0].toLowerCase()], i + n[0].length) : -1;
    }

    function parseMonth(d, string, i) {
      var n = monthRe.exec(string.slice(i));
      return n ? (d.m = monthLookup[n[0].toLowerCase()], i + n[0].length) : -1;
    }

    function parseLocaleDateTime(d, string, i) {
      return parseSpecifier(d, locale_dateTime, string, i);
    }

    function parseLocaleDate(d, string, i) {
      return parseSpecifier(d, locale_date, string, i);
    }

    function parseLocaleTime(d, string, i) {
      return parseSpecifier(d, locale_time, string, i);
    }

    function formatShortWeekday(d) {
      return locale_shortWeekdays[d.getDay()];
    }

    function formatWeekday(d) {
      return locale_weekdays[d.getDay()];
    }

    function formatShortMonth(d) {
      return locale_shortMonths[d.getMonth()];
    }

    function formatMonth(d) {
      return locale_months[d.getMonth()];
    }

    function formatPeriod(d) {
      return locale_periods[+(d.getHours() >= 12)];
    }

    function formatQuarter(d) {
      return 1 + ~~(d.getMonth() / 3);
    }

    function formatUTCShortWeekday(d) {
      return locale_shortWeekdays[d.getUTCDay()];
    }

    function formatUTCWeekday(d) {
      return locale_weekdays[d.getUTCDay()];
    }

    function formatUTCShortMonth(d) {
      return locale_shortMonths[d.getUTCMonth()];
    }

    function formatUTCMonth(d) {
      return locale_months[d.getUTCMonth()];
    }

    function formatUTCPeriod(d) {
      return locale_periods[+(d.getUTCHours() >= 12)];
    }

    function formatUTCQuarter(d) {
      return 1 + ~~(d.getUTCMonth() / 3);
    }

    return {
      format: function(specifier) {
        var f = newFormat(specifier += "", formats);
        f.toString = function() { return specifier; };
        return f;
      },
      parse: function(specifier) {
        var p = newParse(specifier += "", false);
        p.toString = function() { return specifier; };
        return p;
      },
      utcFormat: function(specifier) {
        var f = newFormat(specifier += "", utcFormats);
        f.toString = function() { return specifier; };
        return f;
      },
      utcParse: function(specifier) {
        var p = newParse(specifier += "", true);
        p.toString = function() { return specifier; };
        return p;
      }
    };
  }

  var pads = {"-": "", "_": " ", "0": "0"},
      numberRe = /^\s*\d+/, // note: ignores next directive
      percentRe = /^%/,
      requoteRe = /[\\^$*+?|[\]().{}]/g;

  function pad(value, fill, width) {
    var sign = value < 0 ? "-" : "",
        string = (sign ? -value : value) + "",
        length = string.length;
    return sign + (length < width ? new Array(width - length + 1).join(fill) + string : string);
  }

  function requote(s) {
    return s.replace(requoteRe, "\\$&");
  }

  function formatRe(names) {
    return new RegExp("^(?:" + names.map(requote).join("|") + ")", "i");
  }

  function formatLookup(names) {
    var map = {}, i = -1, n = names.length;
    while (++i < n) map[names[i].toLowerCase()] = i;
    return map;
  }

  function parseWeekdayNumberSunday(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 1));
    return n ? (d.w = +n[0], i + n[0].length) : -1;
  }

  function parseWeekdayNumberMonday(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 1));
    return n ? (d.u = +n[0], i + n[0].length) : -1;
  }

  function parseWeekNumberSunday(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 2));
    return n ? (d.U = +n[0], i + n[0].length) : -1;
  }

  function parseWeekNumberISO(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 2));
    return n ? (d.V = +n[0], i + n[0].length) : -1;
  }

  function parseWeekNumberMonday(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 2));
    return n ? (d.W = +n[0], i + n[0].length) : -1;
  }

  function parseFullYear(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 4));
    return n ? (d.y = +n[0], i + n[0].length) : -1;
  }

  function parseYear(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 2));
    return n ? (d.y = +n[0] + (+n[0] > 68 ? 1900 : 2000), i + n[0].length) : -1;
  }

  function parseZone(d, string, i) {
    var n = /^(Z)|([+-]\d\d)(?::?(\d\d))?/.exec(string.slice(i, i + 6));
    return n ? (d.Z = n[1] ? 0 : -(n[2] + (n[3] || "00")), i + n[0].length) : -1;
  }

  function parseQuarter(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 1));
    return n ? (d.q = n[0] * 3 - 3, i + n[0].length) : -1;
  }

  function parseMonthNumber(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 2));
    return n ? (d.m = n[0] - 1, i + n[0].length) : -1;
  }

  function parseDayOfMonth(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 2));
    return n ? (d.d = +n[0], i + n[0].length) : -1;
  }

  function parseDayOfYear(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 3));
    return n ? (d.m = 0, d.d = +n[0], i + n[0].length) : -1;
  }

  function parseHour24(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 2));
    return n ? (d.H = +n[0], i + n[0].length) : -1;
  }

  function parseMinutes(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 2));
    return n ? (d.M = +n[0], i + n[0].length) : -1;
  }

  function parseSeconds(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 2));
    return n ? (d.S = +n[0], i + n[0].length) : -1;
  }

  function parseMilliseconds(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 3));
    return n ? (d.L = +n[0], i + n[0].length) : -1;
  }

  function parseMicroseconds(d, string, i) {
    var n = numberRe.exec(string.slice(i, i + 6));
    return n ? (d.L = Math.floor(n[0] / 1000), i + n[0].length) : -1;
  }

  function parseLiteralPercent(d, string, i) {
    var n = percentRe.exec(string.slice(i, i + 1));
    return n ? i + n[0].length : -1;
  }

  function parseUnixTimestamp(d, string, i) {
    var n = numberRe.exec(string.slice(i));
    return n ? (d.Q = +n[0], i + n[0].length) : -1;
  }

  function parseUnixTimestampSeconds(d, string, i) {
    var n = numberRe.exec(string.slice(i));
    return n ? (d.s = +n[0], i + n[0].length) : -1;
  }

  function formatDayOfMonth(d, p) {
    return pad(d.getDate(), p, 2);
  }

  function formatHour24(d, p) {
    return pad(d.getHours(), p, 2);
  }

  function formatHour12(d, p) {
    return pad(d.getHours() % 12 || 12, p, 2);
  }

  function formatDayOfYear(d, p) {
    return pad(1 + day.count(year(d), d), p, 3);
  }

  function formatMilliseconds(d, p) {
    return pad(d.getMilliseconds(), p, 3);
  }

  function formatMicroseconds(d, p) {
    return formatMilliseconds(d, p) + "000";
  }

  function formatMonthNumber(d, p) {
    return pad(d.getMonth() + 1, p, 2);
  }

  function formatMinutes(d, p) {
    return pad(d.getMinutes(), p, 2);
  }

  function formatSeconds(d, p) {
    return pad(d.getSeconds(), p, 2);
  }

  function formatWeekdayNumberMonday(d) {
    var day = d.getDay();
    return day === 0 ? 7 : day;
  }

  function formatWeekNumberSunday(d, p) {
    return pad(sunday.count(year(d) - 1, d), p, 2);
  }

  function dISO(d) {
    var day = d.getDay();
    return (day >= 4 || day === 0) ? thursday(d) : thursday.ceil(d);
  }

  function formatWeekNumberISO(d, p) {
    d = dISO(d);
    return pad(thursday.count(year(d), d) + (year(d).getDay() === 4), p, 2);
  }

  function formatWeekdayNumberSunday(d) {
    return d.getDay();
  }

  function formatWeekNumberMonday(d, p) {
    return pad(monday.count(year(d) - 1, d), p, 2);
  }

  function formatYear(d, p) {
    return pad(d.getFullYear() % 100, p, 2);
  }

  function formatYearISO(d, p) {
    d = dISO(d);
    return pad(d.getFullYear() % 100, p, 2);
  }

  function formatFullYear(d, p) {
    return pad(d.getFullYear() % 10000, p, 4);
  }

  function formatFullYearISO(d, p) {
    var day = d.getDay();
    d = (day >= 4 || day === 0) ? thursday(d) : thursday.ceil(d);
    return pad(d.getFullYear() % 10000, p, 4);
  }

  function formatZone(d) {
    var z = d.getTimezoneOffset();
    return (z > 0 ? "-" : (z *= -1, "+"))
        + pad(z / 60 | 0, "0", 2)
        + pad(z % 60, "0", 2);
  }

  function formatUTCDayOfMonth(d, p) {
    return pad(d.getUTCDate(), p, 2);
  }

  function formatUTCHour24(d, p) {
    return pad(d.getUTCHours(), p, 2);
  }

  function formatUTCHour12(d, p) {
    return pad(d.getUTCHours() % 12 || 12, p, 2);
  }

  function formatUTCDayOfYear(d, p) {
    return pad(1 + utcDay.count(utcYear(d), d), p, 3);
  }

  function formatUTCMilliseconds(d, p) {
    return pad(d.getUTCMilliseconds(), p, 3);
  }

  function formatUTCMicroseconds(d, p) {
    return formatUTCMilliseconds(d, p) + "000";
  }

  function formatUTCMonthNumber(d, p) {
    return pad(d.getUTCMonth() + 1, p, 2);
  }

  function formatUTCMinutes(d, p) {
    return pad(d.getUTCMinutes(), p, 2);
  }

  function formatUTCSeconds(d, p) {
    return pad(d.getUTCSeconds(), p, 2);
  }

  function formatUTCWeekdayNumberMonday(d) {
    var dow = d.getUTCDay();
    return dow === 0 ? 7 : dow;
  }

  function formatUTCWeekNumberSunday(d, p) {
    return pad(utcSunday.count(utcYear(d) - 1, d), p, 2);
  }

  function UTCdISO(d) {
    var day = d.getUTCDay();
    return (day >= 4 || day === 0) ? utcThursday(d) : utcThursday.ceil(d);
  }

  function formatUTCWeekNumberISO(d, p) {
    d = UTCdISO(d);
    return pad(utcThursday.count(utcYear(d), d) + (utcYear(d).getUTCDay() === 4), p, 2);
  }

  function formatUTCWeekdayNumberSunday(d) {
    return d.getUTCDay();
  }

  function formatUTCWeekNumberMonday(d, p) {
    return pad(utcMonday.count(utcYear(d) - 1, d), p, 2);
  }

  function formatUTCYear(d, p) {
    return pad(d.getUTCFullYear() % 100, p, 2);
  }

  function formatUTCYearISO(d, p) {
    d = UTCdISO(d);
    return pad(d.getUTCFullYear() % 100, p, 2);
  }

  function formatUTCFullYear(d, p) {
    return pad(d.getUTCFullYear() % 10000, p, 4);
  }

  function formatUTCFullYearISO(d, p) {
    var day = d.getUTCDay();
    d = (day >= 4 || day === 0) ? utcThursday(d) : utcThursday.ceil(d);
    return pad(d.getUTCFullYear() % 10000, p, 4);
  }

  function formatUTCZone() {
    return "+0000";
  }

  function formatLiteralPercent() {
    return "%";
  }

  function formatUnixTimestamp(d) {
    return +d;
  }

  function formatUnixTimestampSeconds(d) {
    return Math.floor(+d / 1000);
  }

  var locale;
  var timeFormat;
  var timeParse;
  var utcFormat;
  var utcParse;

  defaultLocale({
    dateTime: "%x, %X",
    date: "%-m/%-d/%Y",
    time: "%-I:%M:%S %p",
    periods: ["AM", "PM"],
    days: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
    shortDays: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
    shortMonths: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
  });

  function defaultLocale(definition) {
    locale = formatLocale(definition);
    timeFormat = locale.format;
    timeParse = locale.parse;
    utcFormat = locale.utcFormat;
    utcParse = locale.utcParse;
    return locale;
  }

  var isoSpecifier = "%Y-%m-%dT%H:%M:%S.%LZ";

  function formatIsoNative(date) {
    return date.toISOString();
  }

  var formatIso = Date.prototype.toISOString
      ? formatIsoNative
      : utcFormat(isoSpecifier);

  function parseIsoNative(string) {
    var date = new Date(string);
    return isNaN(date) ? null : date;
  }

  var parseIso = +new Date("2000-01-01T00:00:00.000Z")
      ? parseIsoNative
      : utcParse(isoSpecifier);



  var d3$1 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    timeFormatDefaultLocale: defaultLocale,
    get timeFormat () { return timeFormat; },
    get timeParse () { return timeParse; },
    get utcFormat () { return utcFormat; },
    get utcParse () { return utcParse; },
    timeFormatLocale: formatLocale,
    isoFormat: formatIso,
    isoParse: parseIso
  });

  const isNumeric = (n) => !isNaN(n) && isFinite(n);

  function isString$1(value) {
      return typeof value == 'string' || value instanceof String;
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

  function fromPromiseAll(promiseColl) {
      const promiseArray = Array.isArray(promiseColl) ? promiseColl : Object.values(promiseColl);
      if (promiseArray.every(p => p.state == "fulfilled"))
          return fromPromise.resolve(promiseColl);
      if (promiseArray.some(p => p.state == "rejected"))
          return fromPromise.reject(promiseColl);
      return fromPromise((res, rej) => { });
  }

  function defaultDecorator({ base, defaultConfig = {}, functions = {} }) {
      if (Array.isArray(functions)) functions = assign({}, ...functions);
      const newType = function decorate(config, parent, name) {
          applyDefaults(config, defaultConfig);
          delete functions.config;
          base = (base == null) ? (config, parent) => ({ config, parent }) : base;
          return assign(base(config, parent, name), functions);
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

  function configValue(value, concept) {
      const { concept_type } = concept;
      if (concept_type == "time" && value instanceof Date) {
          return concept.format ? utcFormat(concept.format)(value) : formatDate(value);
      }
      return value;
  }


  function range(start, stop, concept) {
      if (concept == "time") concept = "year";
      const interval = d3$1['utc' + ucFirst(concept)];
      const rangeFn = interval ? interval.range : undefined;
      return rangeFn(start, stop);
  }

  function inclusiveRange(start, stop, concept) {
      const result = range(start, stop, concept);
      result.push(stop);
      return result;
  }

  const defaultParsers = [
      utcParse('%Y'),
      utcParse('%Y-%m'),
      utcParse('%Y-%m-%d'),
      utcParse('%Y-%m-%dT%HZ'),
      utcParse('%Y-%m-%dT%H:%MZ'),
      utcParse('%Y-%m-%dT%H:%M:%SZ'),
      utcParse('%Y-%m-%dT%H:%M:%S.%LZ')
  ];

  function tryParse(timeString, parsers) {
      for (let i = 0; i < parsers.length; i++) {
        let dateObject = parsers[i](timeString);
        if (dateObject) return dateObject;
      }
      console.warn('Could not parse time string ' + timeString);
      return null;
  }

  /**
   * Parses string `valueStr` to different type, depending on `concept` type. 
   * Type `time` is parsed to `Date`, `measure` to `number`, any other to string. 
   * If `valueStr` is not a string, it is returned as is.
   * 
   * @param {string} valueStr String to parse
   * @param {Object} concept Concept object of which valueStr is a value
   */
  function parseConfigValue(valueStr, concept) {

      const { concept_type } = concept;

      if (concept_type === "time") {
          if (valueStr instanceof Date)
              return valueStr;
          let parsers = concept.format 
              ? [utcParse(concept.format), ...defaultParsers]
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
          : milliseconds ? formatFullDate(date) + "T" + pad$1(hours, 2) + ":" + pad$1(minutes, 2) + ":" + pad$1(seconds, 2) + "." + pad$1(milliseconds, 3) + "Z"
          : seconds ? formatFullDate(date) + "T" + pad$1(hours, 2) + ":" + pad$1(minutes, 2) + ":" + pad$1(seconds, 2) + "Z"
          : minutes || hours ? formatFullDate(date) + "T" + pad$1(hours, 2) + ":" + pad$1(minutes, 2) + "Z"
          : day !== 1 ? formatFullDate(date)
          : month ? formatYear$1(date.getUTCFullYear()) + "-" + pad$1(date.getUTCMonth() + 1, 2)
          : formatYear$1(date.getUTCFullYear());
  }

  function formatFullDate(date) {
      return formatYear$1(date.getUTCFullYear()) + "-" + pad$1(date.getUTCMonth() + 1, 2) + "-" + pad$1(date.getUTCDate(), 2);
  }

  function formatYear$1(year) {
      return year < 0 ? "-" + pad$1(-year, 6)
          : year > 9999 ? "+" + pad$1(year, 6)
          : pad$1(year, 4);
  }

  function pad$1(value, width) {
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

  /**
   * Creates a stable, unique string representing the object, circumventing the unordered nature of object properties
   * @param {Object} obj 
   * @returns {String} Stable string representation of object
   */
  function stableStringifyObject(obj) { 
      return JSON.stringify(canonicalObject(obj));
  }

  /**
   * Recursively replace any object by an array where each element is on of the object's properties, sorted by the property name.
   * Can be used as stable input for hashing objects, circumventing the unordered nature of object properties.
   * @param {Object} where 
   * @returns {Array}
   */
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
    configValue: configValue,
    range: range,
    inclusiveRange: inclusiveRange,
    parseConfigValue: parseConfigValue,
    defer: defer,
    compose: compose,
    pipe: pipe,
    stableStringifyObject: stableStringifyObject,
    getOrCreate: getOrCreate
  });

  const createStore = function(baseType = config => mobx.observable({ config }), extendedTypes = {}) {
      return mobx.observable({
          modelTypes: {
              base: baseType,
              all: {
                  baseType,
                  ...extendedTypes
              }
          },
          named: new Map(),
          addType: function(modelType, modelConstructor) {
              if (this.modelTypes[modelType])
                  console.warn("Adding model type " + modelType + " failed. Type already exists", this);
              this.modelTypes.all[modelType] = modelConstructor;
          },
          getAll: function() {
              return [ ...this.named.values() ];
          },
          create: mobx.action('create', function(config, parent, id) {
              if (config.config) config = config.config; // get config from model
              //if (isObservableObject(config)) config = toJS(config);
              let modelType = this.modelTypes.all[config.modelType] || this.modelTypes.base;
              let model = mobx.observable(
                  modelType(config, parent, id), 
                  modelType.decorate || undefined, 
                  { name: modelType.name || config.modelType || 'base' }
              );
              if (model.setUpReactions) model.setUpReactions();
              if (id) this.set(id, model);
              return model;
          }),
          has(id) { return this.named.has(id) },
          set: mobx.action('set', function(id, model) { return this.named.set(id, model) }),
          get(idOrConfig, parent) {
              if (isString$1(idOrConfig))
                  return this.named.get(idOrConfig) // id
              else
                  return this.create(idOrConfig, parent) // config
          },
          createMany: function(configs) {
              const models = {};
              for (let id in configs) {
                  models[id] = this.create(configs[id], null, id);
              }
              return models;
          }
      }, {
          named: mobx.observable.shallow
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
      storage.has = keyObj => isRangeKey ? has(keyObj) : has(storage.keyFn(keyObj));
      storage.get = keyObj => isRangeKey ? get(keyObj) : get(storage.keyFn(keyObj));
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
      /**
       * Given a key like 
       * { 
       *      geo: 'swe', 
       *      gender: 'fem' 
       * } 
       * Returns e.g. 
       * { 
       *      name: { 
       *          geo: 'Sweden', 
       *          gender: 'Female' 
       *      }, 
       *      description: { 
       *          geo: 'foo', 
       *          gender: 'bar' 
       *      }
       *  }
       */
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
  function reindex(df, index) {
      const empty = createEmptyRow(df.fields);
      const result = DataFrame([], df.key);
      const keyConcept = df.key[0]; // supports only single indexed
      for (let key of index) {
          const keyObj = { [keyConcept]: key };
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

  /*
    "Differentiate" a given field in this dataframe.
  */
  function differentiate(df, xField = 'x', yField = 'time') {
    let prevX;
    for (let row of df.values()) {
      const difference = prevX ? row[xField] - prevX : 0;
      prevX = row[xField];
      row[xField] = difference;
    }
    return df;
  }

  function interpolateBetween(from, to, mu) {
      const df = DataFrame([], from.key);
      
      let newRow, row2;
      for(const [key, row1] of from) {
          row2 = to.getByObjOrStr(undefined, key);
          if (!row2) continue;
          if (row2 !== row1) { // same object, depends on trails using same object for trail markers across frames.
              newRow = Object.assign({}, row1);
              for (let field in newRow) {
                  newRow[field] = d3.interpolate(row1[field], row2[field])(mu);
              }
          } else {
              newRow = row1;
          }   
          df.set(newRow, newRow[Symbol.for('key')]);
      }
      return df;
  }

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
              interpolateTowards: (df2, mu) => interpolateBetween(df, df2, mu),
              reindex: (stepFn) => reindex(df, stepFn),
              fillNull: (fillValues) => fillNull(df, fillValues),
              copy: () => copy(df),
              differentiate: (xField) => differentiate(df, xField),
      
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
      year: utcParse("%Y"),
      month: utcParse("%Y-%m"),
      day: utcParse("%Y-%m-%d")
  };

  function parserFromDtypes(dtypes) {

      if (dtypes == "auto") 
          return undefined;

      // create field parsers
      const parsers = {};
      let field;
      
      for (field in dtypes) {
          const dtype = dtypes[field];

          let parser;
          if (dtype in dtypeParsers) parser = dtypeParsers[dtype];
          if ("timeFormat" in dtype) parser = timeParse(dtype.timeFormat);

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
              console.info(`Cache can't handle query with more than one select value. Skipping query caching.`, query);
              return undefined;
          }
          return stableStringifyObject(query);
      };
      const has = function (query) { return cache.has(makeKey(query)); };
      const get = function (query) { return cache.get(makeKey(query)); };
      const getAll = function () { return cache; };
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
          getAll,
          set,
          setFromPromise
      }
  }

  const defaults = {
      path: null,
      values: null
  };

  function dataSource(config) {
      const functions = {
          get path() { return this.config.path || defaults.path },
          get reader() {
              if (this.values)
                  return inlineReader({ values: this.values });
              else if (this.path)
                  return csvReader({ path: this.path });
              console.warn("No inline values or csv path found. Please set `values` or `path` property on dataSource.", { dataSource: this });
          },
          get values() { 
              // toJS: don't want insides of data to be observable (adds overhead & complexity)
              return mobx.toJS(this.config.values) || defaults.values;
          },
          get availability() {
              let empty = this.buildAvailability();
              debugger;
              return this.availabilityPromise.case({
                  fulfilled: v => v,
                  pending: () => { console.warn('Requesting availability before availability loaded. Will return empty. Recommended to await promise.'); console.trace(); return empty },
                  error: (e) => { console.warn('Requesting availability when loading errored. Will return empty. Recommended to check promise.'); return empty }
              })
          },
          get concepts() {
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
                  }            });

              return {
                  keyValueLookup,
                  keyLookup,
                  data
              };
          },
          get availabilityPromise() {
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
              //console.log('Adding to queue', query);
              const queryPromise = this.enqueue(query);
              return fromPromise(queryPromise);
          },
          get queue() { return [] },
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
          get cache() { 
              return makeCache(); 
          },
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
                  //console.log('Sending query to reader', query);
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

      return assign({}, functions, configurable, { config });
  }

  dataSource.decorate = {
      // to prevent config.values from becoming observable
      // possibly paints with too broad a brush, other config might need to be deep later
      config: mobx.observable.shallow
  };

  const dataSourceStore = createStore(dataSource);

  const createDataSourceType = function createDataSourceType(readerObject) {
      return defaultDecorator({
          base: dataSource,
          functions: {
              get reader() {
                  // copy reader object (using original would only allow one datasource of this type)
                  const reader = Object.assign({}, readerObject);
                  reader.init(this.config || {});
                  return reader;
              }
          }
      })
  };

  dataSourceStore.createAndAddType = function(type, readerObject) {
      this.addType(type, createDataSourceType(readerObject));
  };

  const defaultConfig = {
      markers: {},
      dimensions: {}
  };

  function filter$1(config = {}, parent) {

      applyDefaults(config, defaultConfig);

      return {
          config,
          parent,
          get markers() {
              const cfg = this.config.markers;
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
              if (Array.isArray(d)) {
                  d.forEach(this.set.bind(this));
                  return;
              }
              const key = this.getKey(d);
              this.config.markers = mapToObj(this.markers.set(key, payLoad));
          }),
          delete: mobx.action("deleteFilter", function(d) {
              if (Array.isArray(d)) {
                  const success = d.map(this.delete.bind(this));
                  return success.any(bool => bool);
              }
              const key = this.getKey(d);
              // deleting from this.config.markers directly doesn't trigger staleness because markers object itself won't change
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

  const defaults$1 = {
      filter: undefined,
      constant: undefined,
      concept: undefined,
      space: undefined,
      value: undefined,
      filter: undefined,
      locale: undefined,
      source: undefined,
      domain: [0, 1],
      domainDataSource: 'auto'
  };

  function dataConfig(config = {}, parent) {

      let latestResponse = [];

      return mobx.observable({
          config,
          parent,
          name: 'data',
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
          eventListeners: new Map(),
          getEventListenersMapFor(prop) {
              if (!this.eventListeners.has(prop))
                  this.eventListeners.set(prop, new Map());
              return this.eventListeners.get(prop);
          },
          get path() {
              this.parent.path + '.' + this.name;
          },
          get invariants() {
              let fails = [];
              if (this.constant && (this.concept || this.source)) fails.push("Can't have constant value and concept or source set.");
              if (this.conceptInSpace && this.source) fails.push("Can't have concept in space and have a source simultaneously");
              if (fails.length > 0)
                  console.warn("One or more invariants not satisfied:",fails,this);
          },
          get hasEncodingMarker() {
              return this.parent && this.parent.marker;
          },
          get source() {
              const source = this.config.source || defaults$1.source;
              if (source)
                  return dataSourceStore.get(source, this)
              else
                  return this.hasEncodingMarker ? this.parent.marker.data.source : null;
          },
          get space() {
              return this.configSolution.space || defaults$1.space;
          },
          get constant() {
              return this.config.constant || defaults$1.constant;
          },
          isConstant() {
              return this.constant != null;
          },
          get commonSpace() {
              if (this.hasEncodingMarker)
                  return intersect(this.space, this.parent.marker.data.space);
              console.warn('Cannot get data.commonSpace of Marker.data. Only meaningful on Encoding.data.');
          },
          get filter() {
              const config = this.config.filter || (this.hasEncodingMarker ? this.parent.marker.data.config.filter : defaults$1.filter);
              return mobx.observable(filter$1(config, this));
          },
          get locale() {
              if (this.config.locale)
                  return typeof this.config.locale == "string" ? this.config.locale : this.config.locale.id;
              else
                  return this.hasEncodingMarker ? this.parent.marker.data.locale : null;          
          },
          get concept() {
              return this.configSolution.concept || defaults$1.concept;
          },
          get conceptProps() { return this.source.getConcept(this.concept) },
          get availability() { return this.source.availability.data.map(kv => this.source.getConcept(kv.value)) },
          get domainDataSource() {
              let source = this.config.domainDataSource || defaults$1.domainDataSource;
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
                  : this.hasEncodingMarker && this.parent.marker.transformedDataMaps.has(source) ? this.parent.marker.transformedDataMaps.get(source).get()
                  : source === 'markers' ? this.parent.marker.dataMap  
                  : this.responseMap;

              return data;
          },
          get domain() {
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

          get marker() {
              if (this.parent) {
                  if (this.parent.marker) {
                      return this.parent.marker;
                  }
                  if (this.parent.encoding) {
                      return this.parent
                  }
              }
              return undefined;
          },

          /**
           * Finds a config which satisfies both marker.space and encoding.concept autoconfigs
           */
          get configSolution() {            
              if (this.marker) {
                  return this.marker.data.markerSolution[this.parent.name];
              } else {
                  return this.encodingSolution();
              }
          },

          encodingSolution(fallbackSpaceCfg, avoidConcepts = []) {
              let space, concept;
              let spaceCfg = this.config.space || fallbackSpaceCfg || defaults$1.space;
              let conceptCfg = this.config.concept || defaults$1.concept;
      
              if (this.needsSpaceAutoCfg) {
                  ({ space, concept } = this.findSpaceAndConcept(spaceCfg, conceptCfg, avoidConcepts));
              } else if (this.needsConceptAutoCfg) {
                  const plainArraySpace = spaceCfg.slice(0);
                  ({ space, concept } = this.findConceptForSpace(plainArraySpace, conceptCfg, avoidConcepts));
              } else {
                  space = spaceCfg;
                  concept = conceptCfg;
              }

              if (!space || !concept)
                  console.warn("Could not resolve space or encoding concepts for encoding.", this.encoding, { space, concept });
              
              return { space, concept };
          },

          findMarkerConfigForSpace(space) {
              let result = {};

              let success = Object.entries(this.parent.encoding).every(([name, enc]) => {
                  // only resolve concepts for encodings which use concept property
                  if (!enc.data.config.concept) {
                      result[name] = undefined;
                      return true;
                  }

                  let encResult = enc.data.encodingSolution(space, Object.values(result).map(r => r.concept));
                  if (encResult.concept && encResult.space) {
                      result[name] = encResult;
                      return true;
                  }
                  return false;
              });

              return success ? result : undefined;
          },

          get markerSolution() {
              
              if (!this.parent.encoding)
                  console.warn(`Can't get marker solution for a non-marker dataconfig.`);

              if (this.config.space && this.config.space.autoconfig) {

                  if (!this.source) {
                      console.warn(`Can't autoconfigure marker space without a source defined.`);
                      return;
                  }

                  return this.autoConfigSpace(this.config.space, this.findMarkerConfigForSpace.bind(this))

              } else {
                  return this.findMarkerConfigForSpace(this.config.space);
              }
          },

          autoConfigSpace(spaceCfg, getFurtherResult) {

              const satisfiesSpaceAutoCfg = createFilterFn(spaceCfg.autoconfig);
              const spaces = [...this.source.availability.keyLookup.values()]
                  .sort((a, b) => a.length - b.length); // smallest spaces first

              for (let space of spaces) {
                  let result;
                  if (!space.includes("concept") 
                      && space
                          .map(c => this.source.getConcept(c))
                          .every(satisfiesSpaceAutoCfg)
                      && (result = getFurtherResult(space))
                  ) {
                      return result
                  }
              }
          },

          findSpaceAndConcept(spaceCfg, conceptCfg, avoidConcepts) {

              return this.autoConfigSpace(spaceCfg, space => {
                  return this.findConceptForSpace(space, conceptCfg, avoidConcepts)
              })
              
          },

          isConceptAvailableForSpace(space, concept) {
              const keyStr = createKeyStr(space);
              return this.source.availability.keyValueLookup.get(keyStr).has(concept);
          },

          findConceptForSpace(space, conceptCfg, avoidConcepts = []) {
              if (conceptCfg && conceptCfg.autoconfig) {
                  const satisfiesAutoCfg = createFilterFn(conceptCfg.autoconfig);
                  const availability = this.source.availability;

                  const concept =  [...availability.keyValueLookup.get(createKeyStr(space)).keys()]
                      // should be able to show space concepts (e.g. time)
                      .concat(space)
                      // first try preferred concepts, otherwise, use avoided concept
                      .filter(concept => !avoidConcepts.includes(concept)) 
                      // exclude the ones such as "is--country", they won't get resolved
                      .filter(concept => concept.substr(0,4) !== "is--")
                      .find(concept => satisfiesAutoCfg(this.source.getConcept(concept)))
                      || avoidConcepts[0]
                      || undefined;

                  return { space, concept };
              } else if (this.isConceptAvailableForSpace(space, conceptCfg)) {
                  return { space, concept: conceptCfg };
              }
              return undefined;
          },

          /**
           * Tries to find encoding concepts for a given space and encodings Map. Returns solution if it succeeds. Returns `undefined` if it fails.
           * @param {String[]} space 
           * @param {Map} encodings Map where keys are encoding names, values are encoding models
           * @returns {Solution|undefined} solution
           */
          /**
           * Tries to find encoding concept for a given space, encoding and partial solution.  
           * Should be called with encoding.data as `this`. 
           * Returns concept id which satisfies encoding definition (incl autoconfig) and does not overlap with partial solution.
           * @param {*} solution object whose keys are encoding names and values concept ids, assigned to those encodings. 
           * @param {*} space 
           * @returns {string} concept id
           */


          get hasOwnData() {
              return this.source && this.concept && !this.conceptInSpace;
          },
          get needsSpaceAutoCfg() {
              return this.config.space && this.config.space.autoconfig;
          },
          get needsConceptAutoCfg() {
              return this.config.concept && this.config.concept.autoconfig;
          },
          get needsAutoConfig() {
              return this.needsSpaceAutoCfg || this.needsConceptAutoCfg
          },
          get needsSource() {
              return this.needsAutoConfig;
          },
          get needsMarkerSource() {
              return !this.config.space && this.marker && this.marker.data.needsSource 
          },
          get promise() {
              const sourcePromises = [];
              if (this.needsSource) { sourcePromises.push(this.source.metaDataPromise); }
              if (this.needsMarkerSource) { sourcePromises.push(this.marker.data.source.metaDataPromise); }
              if (sourcePromises.length > 0) {
                  const combined = fromPromiseAll(sourcePromises);
                  return combined.case({ 
                      fulfilled: () => this.source.query(this.ddfQuery),
                      pending: () => combined,
                  })
              } else {
                  return this.source.query(this.ddfQuery);
              }
          },
          get state() {
              return this.promise.state;
          },
          get response() {
              /*
              if (!this.source || !this.concept || this.conceptInSpace) {
                  if (this.conceptInSpace)
                      console.warn("Encoding " + this.parent.name + " was asked for data but it has no own data. Reason: Concept in space.");
                  else
                      console.warn("Encoding " + this.parent.name + " was asked for data but it has no own data.");
              }
              */
              return this.promise.case({
                  pending: () => latestResponse,
                  rejected: e => latestResponse,
                  fulfilled: (res) => latestResponse = res
              });
          },
          get responseMap() {
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
      });
  }

  function entityPropertyDataConfig(cfg, parent) {
      const base = dataConfig(cfg, parent);

      return composeObj(base, {

          get promise() {
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

  function ascending(a, b) {
    return a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN;
  }

  function bisector(f) {
    let delta = f;
    let compare = f;

    if (f.length === 1) {
      delta = (d, x) => f(d) - x;
      compare = ascendingComparator(f);
    }

    function left(a, x, lo, hi) {
      if (lo == null) lo = 0;
      if (hi == null) hi = a.length;
      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (compare(a[mid], x) < 0) lo = mid + 1;
        else hi = mid;
      }
      return lo;
    }

    function right(a, x, lo, hi) {
      if (lo == null) lo = 0;
      if (hi == null) hi = a.length;
      while (lo < hi) {
        const mid = (lo + hi) >>> 1;
        if (compare(a[mid], x) > 0) hi = mid;
        else lo = mid + 1;
      }
      return lo;
    }

    function center(a, x, lo, hi) {
      if (lo == null) lo = 0;
      if (hi == null) hi = a.length;
      const i = left(a, x, lo, hi - 1);
      return i > lo && delta(a[i - 1], x) > -delta(a[i], x) ? i - 1 : i;
    }

    return {left, center, right};
  }

  function ascendingComparator(f) {
    return (d, x) => ascending(f(d), x);
  }

  function number(x) {
    return x === null ? NaN : +x;
  }

  function* numbers(values, valueof) {
    if (valueof === undefined) {
      for (let value of values) {
        if (value != null && (value = +value) >= value) {
          yield value;
        }
      }
    } else {
      let index = -1;
      for (let value of values) {
        if ((value = valueof(value, ++index, values)) != null && (value = +value) >= value) {
          yield value;
        }
      }
    }
  }

  const ascendingBisect = bisector(ascending);
  const bisectRight = ascendingBisect.right;
  const bisectCenter = bisector(number).center;

  var e10 = Math.sqrt(50),
      e5 = Math.sqrt(10),
      e2 = Math.sqrt(2);

  function ticks(start, stop, count) {
    var reverse,
        i = -1,
        n,
        ticks,
        step;

    stop = +stop, start = +start, count = +count;
    if (start === stop && count > 0) return [start];
    if (reverse = stop < start) n = start, start = stop, stop = n;
    if ((step = tickIncrement(start, stop, count)) === 0 || !isFinite(step)) return [];

    if (step > 0) {
      start = Math.ceil(start / step);
      stop = Math.floor(stop / step);
      ticks = new Array(n = Math.ceil(stop - start + 1));
      while (++i < n) ticks[i] = (start + i) * step;
    } else {
      step = -step;
      start = Math.ceil(start * step);
      stop = Math.floor(stop * step);
      ticks = new Array(n = Math.ceil(stop - start + 1));
      while (++i < n) ticks[i] = (start + i) / step;
    }

    if (reverse) ticks.reverse();

    return ticks;
  }

  function tickIncrement(start, stop, count) {
    var step = (stop - start) / Math.max(0, count),
        power = Math.floor(Math.log(step) / Math.LN10),
        error = step / Math.pow(10, power);
    return power >= 0
        ? (error >= e10 ? 10 : error >= e5 ? 5 : error >= e2 ? 2 : 1) * Math.pow(10, power)
        : -Math.pow(10, -power) / (error >= e10 ? 10 : error >= e5 ? 5 : error >= e2 ? 2 : 1);
  }

  function tickStep(start, stop, count) {
    var step0 = Math.abs(stop - start) / Math.max(0, count),
        step1 = Math.pow(10, Math.floor(Math.log(step0) / Math.LN10)),
        error = step0 / step1;
    if (error >= e10) step1 *= 10;
    else if (error >= e5) step1 *= 5;
    else if (error >= e2) step1 *= 2;
    return stop < start ? -step1 : step1;
  }

  function max(values, valueof) {
    let max;
    if (valueof === undefined) {
      for (const value of values) {
        if (value != null
            && (max < value || (max === undefined && value >= value))) {
          max = value;
        }
      }
    } else {
      let index = -1;
      for (let value of values) {
        if ((value = valueof(value, ++index, values)) != null
            && (max < value || (max === undefined && value >= value))) {
          max = value;
        }
      }
    }
    return max;
  }

  function min(values, valueof) {
    let min;
    if (valueof === undefined) {
      for (const value of values) {
        if (value != null
            && (min > value || (min === undefined && value >= value))) {
          min = value;
        }
      }
    } else {
      let index = -1;
      for (let value of values) {
        if ((value = valueof(value, ++index, values)) != null
            && (min > value || (min === undefined && value >= value))) {
          min = value;
        }
      }
    }
    return min;
  }

  // Based on https://github.com/mourner/quickselect
  // ISC license, Copyright 2018 Vladimir Agafonkin.
  function quickselect(array, k, left = 0, right = array.length - 1, compare = ascending) {
    while (right > left) {
      if (right - left > 600) {
        const n = right - left + 1;
        const m = k - left + 1;
        const z = Math.log(n);
        const s = 0.5 * Math.exp(2 * z / 3);
        const sd = 0.5 * Math.sqrt(z * s * (n - s) / n) * (m - n / 2 < 0 ? -1 : 1);
        const newLeft = Math.max(left, Math.floor(k - m * s / n + sd));
        const newRight = Math.min(right, Math.floor(k + (n - m) * s / n + sd));
        quickselect(array, k, newLeft, newRight, compare);
      }

      const t = array[k];
      let i = left;
      let j = right;

      swap(array, left, k);
      if (compare(array[right], t) > 0) swap(array, left, right);

      while (i < j) {
        swap(array, i, j), ++i, --j;
        while (compare(array[i], t) < 0) ++i;
        while (compare(array[j], t) > 0) --j;
      }

      if (compare(array[left], t) === 0) swap(array, left, j);
      else ++j, swap(array, j, right);

      if (j <= k) left = j + 1;
      if (k <= j) right = j - 1;
    }
    return array;
  }

  function swap(array, i, j) {
    const t = array[i];
    array[i] = array[j];
    array[j] = t;
  }

  function quantile(values, p, valueof) {
    values = Float64Array.from(numbers(values, valueof));
    if (!(n = values.length)) return;
    if ((p = +p) <= 0 || n < 2) return min(values);
    if (p >= 1) return max(values);
    var n,
        i = (n - 1) * p,
        i0 = Math.floor(i),
        value0 = max(quickselect(values, i0).subarray(0, i0 + 1)),
        value1 = min(values.subarray(i0 + 1));
    return value0 + (value1 - value0) * (i - i0);
  }

  function quantileSorted(values, p, valueof = number) {
    if (!(n = values.length)) return;
    if ((p = +p) <= 0 || n < 2) return +valueof(values[0], 0, values);
    if (p >= 1) return +valueof(values[n - 1], n - 1, values);
    var n,
        i = (n - 1) * p,
        i0 = Math.floor(i),
        value0 = +valueof(values[i0], i0, values),
        value1 = +valueof(values[i0 + 1], i0 + 1, values);
    return value0 + (value1 - value0) * (i - i0);
  }

  function sequence(start, stop, step) {
    start = +start, stop = +stop, step = (n = arguments.length) < 2 ? (stop = start, start = 0, 1) : n < 3 ? 1 : +step;

    var i = -1,
        n = Math.max(0, Math.ceil((stop - start) / step)) | 0,
        range = new Array(n);

    while (++i < n) {
      range[i] = start + i * step;
    }

    return range;
  }

  function initRange(domain, range) {
    switch (arguments.length) {
      case 0: break;
      case 1: this.range(domain); break;
      default: this.range(range).domain(domain); break;
    }
    return this;
  }

  function initInterpolator(domain, interpolator) {
    switch (arguments.length) {
      case 0: break;
      case 1: {
        if (typeof domain === "function") this.interpolator(domain);
        else this.range(domain);
        break;
      }
      default: {
        this.domain(domain);
        if (typeof interpolator === "function") this.interpolator(interpolator);
        else this.range(interpolator);
        break;
      }
    }
    return this;
  }

  const implicit = Symbol("implicit");

  function ordinal() {
    var index = new Map(),
        domain = [],
        range = [],
        unknown = implicit;

    function scale(d) {
      var key = d + "", i = index.get(key);
      if (!i) {
        if (unknown !== implicit) return unknown;
        index.set(key, i = domain.push(d));
      }
      return range[(i - 1) % range.length];
    }

    scale.domain = function(_) {
      if (!arguments.length) return domain.slice();
      domain = [], index = new Map();
      for (const value of _) {
        const key = value + "";
        if (index.has(key)) continue;
        index.set(key, domain.push(value));
      }
      return scale;
    };

    scale.range = function(_) {
      return arguments.length ? (range = Array.from(_), scale) : range.slice();
    };

    scale.unknown = function(_) {
      return arguments.length ? (unknown = _, scale) : unknown;
    };

    scale.copy = function() {
      return ordinal(domain, range).unknown(unknown);
    };

    initRange.apply(scale, arguments);

    return scale;
  }

  function band() {
    var scale = ordinal().unknown(undefined),
        domain = scale.domain,
        ordinalRange = scale.range,
        r0 = 0,
        r1 = 1,
        step,
        bandwidth,
        round = false,
        paddingInner = 0,
        paddingOuter = 0,
        align = 0.5;

    delete scale.unknown;

    function rescale() {
      var n = domain().length,
          reverse = r1 < r0,
          start = reverse ? r1 : r0,
          stop = reverse ? r0 : r1;
      step = (stop - start) / Math.max(1, n - paddingInner + paddingOuter * 2);
      if (round) step = Math.floor(step);
      start += (stop - start - step * (n - paddingInner)) * align;
      bandwidth = step * (1 - paddingInner);
      if (round) start = Math.round(start), bandwidth = Math.round(bandwidth);
      var values = sequence(n).map(function(i) { return start + step * i; });
      return ordinalRange(reverse ? values.reverse() : values);
    }

    scale.domain = function(_) {
      return arguments.length ? (domain(_), rescale()) : domain();
    };

    scale.range = function(_) {
      return arguments.length ? ([r0, r1] = _, r0 = +r0, r1 = +r1, rescale()) : [r0, r1];
    };

    scale.rangeRound = function(_) {
      return [r0, r1] = _, r0 = +r0, r1 = +r1, round = true, rescale();
    };

    scale.bandwidth = function() {
      return bandwidth;
    };

    scale.step = function() {
      return step;
    };

    scale.round = function(_) {
      return arguments.length ? (round = !!_, rescale()) : round;
    };

    scale.padding = function(_) {
      return arguments.length ? (paddingInner = Math.min(1, paddingOuter = +_), rescale()) : paddingInner;
    };

    scale.paddingInner = function(_) {
      return arguments.length ? (paddingInner = Math.min(1, _), rescale()) : paddingInner;
    };

    scale.paddingOuter = function(_) {
      return arguments.length ? (paddingOuter = +_, rescale()) : paddingOuter;
    };

    scale.align = function(_) {
      return arguments.length ? (align = Math.max(0, Math.min(1, _)), rescale()) : align;
    };

    scale.copy = function() {
      return band(domain(), [r0, r1])
          .round(round)
          .paddingInner(paddingInner)
          .paddingOuter(paddingOuter)
          .align(align);
    };

    return initRange.apply(rescale(), arguments);
  }

  function pointish(scale) {
    var copy = scale.copy;

    scale.padding = scale.paddingOuter;
    delete scale.paddingInner;
    delete scale.paddingOuter;

    scale.copy = function() {
      return pointish(copy());
    };

    return scale;
  }

  function point() {
    return pointish(band.apply(null, arguments).paddingInner(1));
  }

  function define(constructor, factory, prototype) {
    constructor.prototype = factory.prototype = prototype;
    prototype.constructor = constructor;
  }

  function extend(parent, definition) {
    var prototype = Object.create(parent.prototype);
    for (var key in definition) prototype[key] = definition[key];
    return prototype;
  }

  function Color() {}

  var darker = 0.7;
  var brighter = 1 / darker;

  var reI = "\\s*([+-]?\\d+)\\s*",
      reN = "\\s*([+-]?\\d*\\.?\\d+(?:[eE][+-]?\\d+)?)\\s*",
      reP = "\\s*([+-]?\\d*\\.?\\d+(?:[eE][+-]?\\d+)?)%\\s*",
      reHex = /^#([0-9a-f]{3,8})$/,
      reRgbInteger = new RegExp("^rgb\\(" + [reI, reI, reI] + "\\)$"),
      reRgbPercent = new RegExp("^rgb\\(" + [reP, reP, reP] + "\\)$"),
      reRgbaInteger = new RegExp("^rgba\\(" + [reI, reI, reI, reN] + "\\)$"),
      reRgbaPercent = new RegExp("^rgba\\(" + [reP, reP, reP, reN] + "\\)$"),
      reHslPercent = new RegExp("^hsl\\(" + [reN, reP, reP] + "\\)$"),
      reHslaPercent = new RegExp("^hsla\\(" + [reN, reP, reP, reN] + "\\)$");

  var named = {
    aliceblue: 0xf0f8ff,
    antiquewhite: 0xfaebd7,
    aqua: 0x00ffff,
    aquamarine: 0x7fffd4,
    azure: 0xf0ffff,
    beige: 0xf5f5dc,
    bisque: 0xffe4c4,
    black: 0x000000,
    blanchedalmond: 0xffebcd,
    blue: 0x0000ff,
    blueviolet: 0x8a2be2,
    brown: 0xa52a2a,
    burlywood: 0xdeb887,
    cadetblue: 0x5f9ea0,
    chartreuse: 0x7fff00,
    chocolate: 0xd2691e,
    coral: 0xff7f50,
    cornflowerblue: 0x6495ed,
    cornsilk: 0xfff8dc,
    crimson: 0xdc143c,
    cyan: 0x00ffff,
    darkblue: 0x00008b,
    darkcyan: 0x008b8b,
    darkgoldenrod: 0xb8860b,
    darkgray: 0xa9a9a9,
    darkgreen: 0x006400,
    darkgrey: 0xa9a9a9,
    darkkhaki: 0xbdb76b,
    darkmagenta: 0x8b008b,
    darkolivegreen: 0x556b2f,
    darkorange: 0xff8c00,
    darkorchid: 0x9932cc,
    darkred: 0x8b0000,
    darksalmon: 0xe9967a,
    darkseagreen: 0x8fbc8f,
    darkslateblue: 0x483d8b,
    darkslategray: 0x2f4f4f,
    darkslategrey: 0x2f4f4f,
    darkturquoise: 0x00ced1,
    darkviolet: 0x9400d3,
    deeppink: 0xff1493,
    deepskyblue: 0x00bfff,
    dimgray: 0x696969,
    dimgrey: 0x696969,
    dodgerblue: 0x1e90ff,
    firebrick: 0xb22222,
    floralwhite: 0xfffaf0,
    forestgreen: 0x228b22,
    fuchsia: 0xff00ff,
    gainsboro: 0xdcdcdc,
    ghostwhite: 0xf8f8ff,
    gold: 0xffd700,
    goldenrod: 0xdaa520,
    gray: 0x808080,
    green: 0x008000,
    greenyellow: 0xadff2f,
    grey: 0x808080,
    honeydew: 0xf0fff0,
    hotpink: 0xff69b4,
    indianred: 0xcd5c5c,
    indigo: 0x4b0082,
    ivory: 0xfffff0,
    khaki: 0xf0e68c,
    lavender: 0xe6e6fa,
    lavenderblush: 0xfff0f5,
    lawngreen: 0x7cfc00,
    lemonchiffon: 0xfffacd,
    lightblue: 0xadd8e6,
    lightcoral: 0xf08080,
    lightcyan: 0xe0ffff,
    lightgoldenrodyellow: 0xfafad2,
    lightgray: 0xd3d3d3,
    lightgreen: 0x90ee90,
    lightgrey: 0xd3d3d3,
    lightpink: 0xffb6c1,
    lightsalmon: 0xffa07a,
    lightseagreen: 0x20b2aa,
    lightskyblue: 0x87cefa,
    lightslategray: 0x778899,
    lightslategrey: 0x778899,
    lightsteelblue: 0xb0c4de,
    lightyellow: 0xffffe0,
    lime: 0x00ff00,
    limegreen: 0x32cd32,
    linen: 0xfaf0e6,
    magenta: 0xff00ff,
    maroon: 0x800000,
    mediumaquamarine: 0x66cdaa,
    mediumblue: 0x0000cd,
    mediumorchid: 0xba55d3,
    mediumpurple: 0x9370db,
    mediumseagreen: 0x3cb371,
    mediumslateblue: 0x7b68ee,
    mediumspringgreen: 0x00fa9a,
    mediumturquoise: 0x48d1cc,
    mediumvioletred: 0xc71585,
    midnightblue: 0x191970,
    mintcream: 0xf5fffa,
    mistyrose: 0xffe4e1,
    moccasin: 0xffe4b5,
    navajowhite: 0xffdead,
    navy: 0x000080,
    oldlace: 0xfdf5e6,
    olive: 0x808000,
    olivedrab: 0x6b8e23,
    orange: 0xffa500,
    orangered: 0xff4500,
    orchid: 0xda70d6,
    palegoldenrod: 0xeee8aa,
    palegreen: 0x98fb98,
    paleturquoise: 0xafeeee,
    palevioletred: 0xdb7093,
    papayawhip: 0xffefd5,
    peachpuff: 0xffdab9,
    peru: 0xcd853f,
    pink: 0xffc0cb,
    plum: 0xdda0dd,
    powderblue: 0xb0e0e6,
    purple: 0x800080,
    rebeccapurple: 0x663399,
    red: 0xff0000,
    rosybrown: 0xbc8f8f,
    royalblue: 0x4169e1,
    saddlebrown: 0x8b4513,
    salmon: 0xfa8072,
    sandybrown: 0xf4a460,
    seagreen: 0x2e8b57,
    seashell: 0xfff5ee,
    sienna: 0xa0522d,
    silver: 0xc0c0c0,
    skyblue: 0x87ceeb,
    slateblue: 0x6a5acd,
    slategray: 0x708090,
    slategrey: 0x708090,
    snow: 0xfffafa,
    springgreen: 0x00ff7f,
    steelblue: 0x4682b4,
    tan: 0xd2b48c,
    teal: 0x008080,
    thistle: 0xd8bfd8,
    tomato: 0xff6347,
    turquoise: 0x40e0d0,
    violet: 0xee82ee,
    wheat: 0xf5deb3,
    white: 0xffffff,
    whitesmoke: 0xf5f5f5,
    yellow: 0xffff00,
    yellowgreen: 0x9acd32
  };

  define(Color, color, {
    copy: function(channels) {
      return Object.assign(new this.constructor, this, channels);
    },
    displayable: function() {
      return this.rgb().displayable();
    },
    hex: color_formatHex, // Deprecated! Use color.formatHex.
    formatHex: color_formatHex,
    formatHsl: color_formatHsl,
    formatRgb: color_formatRgb,
    toString: color_formatRgb
  });

  function color_formatHex() {
    return this.rgb().formatHex();
  }

  function color_formatHsl() {
    return hslConvert(this).formatHsl();
  }

  function color_formatRgb() {
    return this.rgb().formatRgb();
  }

  function color(format) {
    var m, l;
    format = (format + "").trim().toLowerCase();
    return (m = reHex.exec(format)) ? (l = m[1].length, m = parseInt(m[1], 16), l === 6 ? rgbn(m) // #ff0000
        : l === 3 ? new Rgb((m >> 8 & 0xf) | (m >> 4 & 0xf0), (m >> 4 & 0xf) | (m & 0xf0), ((m & 0xf) << 4) | (m & 0xf), 1) // #f00
        : l === 8 ? rgba(m >> 24 & 0xff, m >> 16 & 0xff, m >> 8 & 0xff, (m & 0xff) / 0xff) // #ff000000
        : l === 4 ? rgba((m >> 12 & 0xf) | (m >> 8 & 0xf0), (m >> 8 & 0xf) | (m >> 4 & 0xf0), (m >> 4 & 0xf) | (m & 0xf0), (((m & 0xf) << 4) | (m & 0xf)) / 0xff) // #f000
        : null) // invalid hex
        : (m = reRgbInteger.exec(format)) ? new Rgb(m[1], m[2], m[3], 1) // rgb(255, 0, 0)
        : (m = reRgbPercent.exec(format)) ? new Rgb(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100, 1) // rgb(100%, 0%, 0%)
        : (m = reRgbaInteger.exec(format)) ? rgba(m[1], m[2], m[3], m[4]) // rgba(255, 0, 0, 1)
        : (m = reRgbaPercent.exec(format)) ? rgba(m[1] * 255 / 100, m[2] * 255 / 100, m[3] * 255 / 100, m[4]) // rgb(100%, 0%, 0%, 1)
        : (m = reHslPercent.exec(format)) ? hsla(m[1], m[2] / 100, m[3] / 100, 1) // hsl(120, 50%, 50%)
        : (m = reHslaPercent.exec(format)) ? hsla(m[1], m[2] / 100, m[3] / 100, m[4]) // hsla(120, 50%, 50%, 1)
        : named.hasOwnProperty(format) ? rgbn(named[format]) // eslint-disable-line no-prototype-builtins
        : format === "transparent" ? new Rgb(NaN, NaN, NaN, 0)
        : null;
  }

  function rgbn(n) {
    return new Rgb(n >> 16 & 0xff, n >> 8 & 0xff, n & 0xff, 1);
  }

  function rgba(r, g, b, a) {
    if (a <= 0) r = g = b = NaN;
    return new Rgb(r, g, b, a);
  }

  function rgbConvert(o) {
    if (!(o instanceof Color)) o = color(o);
    if (!o) return new Rgb;
    o = o.rgb();
    return new Rgb(o.r, o.g, o.b, o.opacity);
  }

  function rgb(r, g, b, opacity) {
    return arguments.length === 1 ? rgbConvert(r) : new Rgb(r, g, b, opacity == null ? 1 : opacity);
  }

  function Rgb(r, g, b, opacity) {
    this.r = +r;
    this.g = +g;
    this.b = +b;
    this.opacity = +opacity;
  }

  define(Rgb, rgb, extend(Color, {
    brighter: function(k) {
      k = k == null ? brighter : Math.pow(brighter, k);
      return new Rgb(this.r * k, this.g * k, this.b * k, this.opacity);
    },
    darker: function(k) {
      k = k == null ? darker : Math.pow(darker, k);
      return new Rgb(this.r * k, this.g * k, this.b * k, this.opacity);
    },
    rgb: function() {
      return this;
    },
    displayable: function() {
      return (-0.5 <= this.r && this.r < 255.5)
          && (-0.5 <= this.g && this.g < 255.5)
          && (-0.5 <= this.b && this.b < 255.5)
          && (0 <= this.opacity && this.opacity <= 1);
    },
    hex: rgb_formatHex, // Deprecated! Use color.formatHex.
    formatHex: rgb_formatHex,
    formatRgb: rgb_formatRgb,
    toString: rgb_formatRgb
  }));

  function rgb_formatHex() {
    return "#" + hex(this.r) + hex(this.g) + hex(this.b);
  }

  function rgb_formatRgb() {
    var a = this.opacity; a = isNaN(a) ? 1 : Math.max(0, Math.min(1, a));
    return (a === 1 ? "rgb(" : "rgba(")
        + Math.max(0, Math.min(255, Math.round(this.r) || 0)) + ", "
        + Math.max(0, Math.min(255, Math.round(this.g) || 0)) + ", "
        + Math.max(0, Math.min(255, Math.round(this.b) || 0))
        + (a === 1 ? ")" : ", " + a + ")");
  }

  function hex(value) {
    value = Math.max(0, Math.min(255, Math.round(value) || 0));
    return (value < 16 ? "0" : "") + value.toString(16);
  }

  function hsla(h, s, l, a) {
    if (a <= 0) h = s = l = NaN;
    else if (l <= 0 || l >= 1) h = s = NaN;
    else if (s <= 0) h = NaN;
    return new Hsl(h, s, l, a);
  }

  function hslConvert(o) {
    if (o instanceof Hsl) return new Hsl(o.h, o.s, o.l, o.opacity);
    if (!(o instanceof Color)) o = color(o);
    if (!o) return new Hsl;
    if (o instanceof Hsl) return o;
    o = o.rgb();
    var r = o.r / 255,
        g = o.g / 255,
        b = o.b / 255,
        min = Math.min(r, g, b),
        max = Math.max(r, g, b),
        h = NaN,
        s = max - min,
        l = (max + min) / 2;
    if (s) {
      if (r === max) h = (g - b) / s + (g < b) * 6;
      else if (g === max) h = (b - r) / s + 2;
      else h = (r - g) / s + 4;
      s /= l < 0.5 ? max + min : 2 - max - min;
      h *= 60;
    } else {
      s = l > 0 && l < 1 ? 0 : h;
    }
    return new Hsl(h, s, l, o.opacity);
  }

  function hsl(h, s, l, opacity) {
    return arguments.length === 1 ? hslConvert(h) : new Hsl(h, s, l, opacity == null ? 1 : opacity);
  }

  function Hsl(h, s, l, opacity) {
    this.h = +h;
    this.s = +s;
    this.l = +l;
    this.opacity = +opacity;
  }

  define(Hsl, hsl, extend(Color, {
    brighter: function(k) {
      k = k == null ? brighter : Math.pow(brighter, k);
      return new Hsl(this.h, this.s, this.l * k, this.opacity);
    },
    darker: function(k) {
      k = k == null ? darker : Math.pow(darker, k);
      return new Hsl(this.h, this.s, this.l * k, this.opacity);
    },
    rgb: function() {
      var h = this.h % 360 + (this.h < 0) * 360,
          s = isNaN(h) || isNaN(this.s) ? 0 : this.s,
          l = this.l,
          m2 = l + (l < 0.5 ? l : 1 - l) * s,
          m1 = 2 * l - m2;
      return new Rgb(
        hsl2rgb(h >= 240 ? h - 240 : h + 120, m1, m2),
        hsl2rgb(h, m1, m2),
        hsl2rgb(h < 120 ? h + 240 : h - 120, m1, m2),
        this.opacity
      );
    },
    displayable: function() {
      return (0 <= this.s && this.s <= 1 || isNaN(this.s))
          && (0 <= this.l && this.l <= 1)
          && (0 <= this.opacity && this.opacity <= 1);
    },
    formatHsl: function() {
      var a = this.opacity; a = isNaN(a) ? 1 : Math.max(0, Math.min(1, a));
      return (a === 1 ? "hsl(" : "hsla(")
          + (this.h || 0) + ", "
          + (this.s || 0) * 100 + "%, "
          + (this.l || 0) * 100 + "%"
          + (a === 1 ? ")" : ", " + a + ")");
    }
  }));

  /* From FvD 13.37, CSS Color Module Level 3 */
  function hsl2rgb(h, m1, m2) {
    return (h < 60 ? m1 + (m2 - m1) * h / 60
        : h < 180 ? m2
        : h < 240 ? m1 + (m2 - m1) * (240 - h) / 60
        : m1) * 255;
  }

  var constant = x => () => x;

  function linear(a, d) {
    return function(t) {
      return a + t * d;
    };
  }

  function exponential(a, b, y) {
    return a = Math.pow(a, y), b = Math.pow(b, y) - a, y = 1 / y, function(t) {
      return Math.pow(a + t * b, y);
    };
  }

  function gamma(y) {
    return (y = +y) === 1 ? nogamma : function(a, b) {
      return b - a ? exponential(a, b, y) : constant(isNaN(a) ? b : a);
    };
  }

  function nogamma(a, b) {
    var d = b - a;
    return d ? linear(a, d) : constant(isNaN(a) ? b : a);
  }

  var rgb$1 = (function rgbGamma(y) {
    var color = gamma(y);

    function rgb$1(start, end) {
      var r = color((start = rgb(start)).r, (end = rgb(end)).r),
          g = color(start.g, end.g),
          b = color(start.b, end.b),
          opacity = nogamma(start.opacity, end.opacity);
      return function(t) {
        start.r = r(t);
        start.g = g(t);
        start.b = b(t);
        start.opacity = opacity(t);
        return start + "";
      };
    }

    rgb$1.gamma = rgbGamma;

    return rgb$1;
  })(1);

  function numberArray(a, b) {
    if (!b) b = [];
    var n = a ? Math.min(b.length, a.length) : 0,
        c = b.slice(),
        i;
    return function(t) {
      for (i = 0; i < n; ++i) c[i] = a[i] * (1 - t) + b[i] * t;
      return c;
    };
  }

  function isNumberArray(x) {
    return ArrayBuffer.isView(x) && !(x instanceof DataView);
  }

  function genericArray(a, b) {
    var nb = b ? b.length : 0,
        na = a ? Math.min(nb, a.length) : 0,
        x = new Array(na),
        c = new Array(nb),
        i;

    for (i = 0; i < na; ++i) x[i] = interpolate$1(a[i], b[i]);
    for (; i < nb; ++i) c[i] = b[i];

    return function(t) {
      for (i = 0; i < na; ++i) c[i] = x[i](t);
      return c;
    };
  }

  function date(a, b) {
    var d = new Date;
    return a = +a, b = +b, function(t) {
      return d.setTime(a * (1 - t) + b * t), d;
    };
  }

  function interpolateNumber(a, b) {
    return a = +a, b = +b, function(t) {
      return a * (1 - t) + b * t;
    };
  }

  function object(a, b) {
    var i = {},
        c = {},
        k;

    if (a === null || typeof a !== "object") a = {};
    if (b === null || typeof b !== "object") b = {};

    for (k in b) {
      if (k in a) {
        i[k] = interpolate$1(a[k], b[k]);
      } else {
        c[k] = b[k];
      }
    }

    return function(t) {
      for (k in i) c[k] = i[k](t);
      return c;
    };
  }

  var reA = /[-+]?(?:\d+\.?\d*|\.?\d+)(?:[eE][-+]?\d+)?/g,
      reB = new RegExp(reA.source, "g");

  function zero(b) {
    return function() {
      return b;
    };
  }

  function one(b) {
    return function(t) {
      return b(t) + "";
    };
  }

  function string(a, b) {
    var bi = reA.lastIndex = reB.lastIndex = 0, // scan index for next number in b
        am, // current match in a
        bm, // current match in b
        bs, // string preceding current number in b, if any
        i = -1, // index in s
        s = [], // string constants and placeholders
        q = []; // number interpolators

    // Coerce inputs to strings.
    a = a + "", b = b + "";

    // Interpolate pairs of numbers in a & b.
    while ((am = reA.exec(a))
        && (bm = reB.exec(b))) {
      if ((bs = bm.index) > bi) { // a string precedes the next number in b
        bs = b.slice(bi, bs);
        if (s[i]) s[i] += bs; // coalesce with previous string
        else s[++i] = bs;
      }
      if ((am = am[0]) === (bm = bm[0])) { // numbers in a & b match
        if (s[i]) s[i] += bm; // coalesce with previous string
        else s[++i] = bm;
      } else { // interpolate non-matching numbers
        s[++i] = null;
        q.push({i: i, x: interpolateNumber(am, bm)});
      }
      bi = reB.lastIndex;
    }

    // Add remains of b.
    if (bi < b.length) {
      bs = b.slice(bi);
      if (s[i]) s[i] += bs; // coalesce with previous string
      else s[++i] = bs;
    }

    // Special optimization for only a single match.
    // Otherwise, interpolate each of the numbers and rejoin the string.
    return s.length < 2 ? (q[0]
        ? one(q[0].x)
        : zero(b))
        : (b = q.length, function(t) {
            for (var i = 0, o; i < b; ++i) s[(o = q[i]).i] = o.x(t);
            return s.join("");
          });
  }

  function interpolate$1(a, b) {
    var t = typeof b, c;
    return b == null || t === "boolean" ? constant(b)
        : (t === "number" ? interpolateNumber
        : t === "string" ? ((c = color(b)) ? (b = c, rgb$1) : string)
        : b instanceof color ? rgb$1
        : b instanceof Date ? date
        : isNumberArray(b) ? numberArray
        : Array.isArray(b) ? genericArray
        : typeof b.valueOf !== "function" && typeof b.toString !== "function" || isNaN(b) ? object
        : interpolateNumber)(a, b);
  }

  function interpolateRound(a, b) {
    return a = +a, b = +b, function(t) {
      return Math.round(a * (1 - t) + b * t);
    };
  }

  function piecewise(interpolate, values) {
    if (values === undefined) values = interpolate, interpolate = interpolate$1;
    var i = 0, n = values.length - 1, v = values[0], I = new Array(n < 0 ? 0 : n);
    while (i < n) I[i] = interpolate(v, v = values[++i]);
    return function(t) {
      var i = Math.max(0, Math.min(n - 1, Math.floor(t *= n)));
      return I[i](t - i);
    };
  }

  function constants(x) {
    return function() {
      return x;
    };
  }

  function number$1(x) {
    return +x;
  }

  var unit = [0, 1];

  function identity(x) {
    return x;
  }

  function normalize(a, b) {
    return (b -= (a = +a))
        ? function(x) { return (x - a) / b; }
        : constants(isNaN(b) ? NaN : 0.5);
  }

  function clamper(a, b) {
    var t;
    if (a > b) t = a, a = b, b = t;
    return function(x) { return Math.max(a, Math.min(b, x)); };
  }

  // normalize(a, b)(x) takes a domain value x in [a,b] and returns the corresponding parameter t in [0,1].
  // interpolate(a, b)(t) takes a parameter t in [0,1] and returns the corresponding range value x in [a,b].
  function bimap(domain, range, interpolate) {
    var d0 = domain[0], d1 = domain[1], r0 = range[0], r1 = range[1];
    if (d1 < d0) d0 = normalize(d1, d0), r0 = interpolate(r1, r0);
    else d0 = normalize(d0, d1), r0 = interpolate(r0, r1);
    return function(x) { return r0(d0(x)); };
  }

  function polymap(domain, range, interpolate) {
    var j = Math.min(domain.length, range.length) - 1,
        d = new Array(j),
        r = new Array(j),
        i = -1;

    // Reverse descending domains.
    if (domain[j] < domain[0]) {
      domain = domain.slice().reverse();
      range = range.slice().reverse();
    }

    while (++i < j) {
      d[i] = normalize(domain[i], domain[i + 1]);
      r[i] = interpolate(range[i], range[i + 1]);
    }

    return function(x) {
      var i = bisectRight(domain, x, 1, j) - 1;
      return r[i](d[i](x));
    };
  }

  function copy$1(source, target) {
    return target
        .domain(source.domain())
        .range(source.range())
        .interpolate(source.interpolate())
        .clamp(source.clamp())
        .unknown(source.unknown());
  }

  function transformer() {
    var domain = unit,
        range = unit,
        interpolate = interpolate$1,
        transform,
        untransform,
        unknown,
        clamp = identity,
        piecewise,
        output,
        input;

    function rescale() {
      var n = Math.min(domain.length, range.length);
      if (clamp !== identity) clamp = clamper(domain[0], domain[n - 1]);
      piecewise = n > 2 ? polymap : bimap;
      output = input = null;
      return scale;
    }

    function scale(x) {
      return isNaN(x = +x) ? unknown : (output || (output = piecewise(domain.map(transform), range, interpolate)))(transform(clamp(x)));
    }

    scale.invert = function(y) {
      return clamp(untransform((input || (input = piecewise(range, domain.map(transform), interpolateNumber)))(y)));
    };

    scale.domain = function(_) {
      return arguments.length ? (domain = Array.from(_, number$1), rescale()) : domain.slice();
    };

    scale.range = function(_) {
      return arguments.length ? (range = Array.from(_), rescale()) : range.slice();
    };

    scale.rangeRound = function(_) {
      return range = Array.from(_), interpolate = interpolateRound, rescale();
    };

    scale.clamp = function(_) {
      return arguments.length ? (clamp = _ ? true : identity, rescale()) : clamp !== identity;
    };

    scale.interpolate = function(_) {
      return arguments.length ? (interpolate = _, rescale()) : interpolate;
    };

    scale.unknown = function(_) {
      return arguments.length ? (unknown = _, scale) : unknown;
    };

    return function(t, u) {
      transform = t, untransform = u;
      return rescale();
    };
  }

  function continuous() {
    return transformer()(identity, identity);
  }

  function formatDecimal(x) {
    return Math.abs(x = Math.round(x)) >= 1e21
        ? x.toLocaleString("en").replace(/,/g, "")
        : x.toString(10);
  }

  // Computes the decimal coefficient and exponent of the specified number x with
  // significant digits p, where x is positive and p is in [1, 21] or undefined.
  // For example, formatDecimalParts(1.23) returns ["123", 0].
  function formatDecimalParts(x, p) {
    if ((i = (x = p ? x.toExponential(p - 1) : x.toExponential()).indexOf("e")) < 0) return null; // NaN, ±Infinity
    var i, coefficient = x.slice(0, i);

    // The string returned by toExponential either has the form \d\.\d+e[-+]\d+
    // (e.g., 1.2e+3) or the form \de[-+]\d+ (e.g., 1e+3).
    return [
      coefficient.length > 1 ? coefficient[0] + coefficient.slice(2) : coefficient,
      +x.slice(i + 1)
    ];
  }

  function exponent(x) {
    return x = formatDecimalParts(Math.abs(x)), x ? x[1] : NaN;
  }

  function formatGroup(grouping, thousands) {
    return function(value, width) {
      var i = value.length,
          t = [],
          j = 0,
          g = grouping[0],
          length = 0;

      while (i > 0 && g > 0) {
        if (length + g + 1 > width) g = Math.max(1, width - length);
        t.push(value.substring(i -= g, i + g));
        if ((length += g + 1) > width) break;
        g = grouping[j = (j + 1) % grouping.length];
      }

      return t.reverse().join(thousands);
    };
  }

  function formatNumerals(numerals) {
    return function(value) {
      return value.replace(/[0-9]/g, function(i) {
        return numerals[+i];
      });
    };
  }

  // [[fill]align][sign][symbol][0][width][,][.precision][~][type]
  var re = /^(?:(.)?([<>=^]))?([+\-( ])?([$#])?(0)?(\d+)?(,)?(\.\d+)?(~)?([a-z%])?$/i;

  function formatSpecifier(specifier) {
    if (!(match = re.exec(specifier))) throw new Error("invalid format: " + specifier);
    var match;
    return new FormatSpecifier({
      fill: match[1],
      align: match[2],
      sign: match[3],
      symbol: match[4],
      zero: match[5],
      width: match[6],
      comma: match[7],
      precision: match[8] && match[8].slice(1),
      trim: match[9],
      type: match[10]
    });
  }

  formatSpecifier.prototype = FormatSpecifier.prototype; // instanceof

  function FormatSpecifier(specifier) {
    this.fill = specifier.fill === undefined ? " " : specifier.fill + "";
    this.align = specifier.align === undefined ? ">" : specifier.align + "";
    this.sign = specifier.sign === undefined ? "-" : specifier.sign + "";
    this.symbol = specifier.symbol === undefined ? "" : specifier.symbol + "";
    this.zero = !!specifier.zero;
    this.width = specifier.width === undefined ? undefined : +specifier.width;
    this.comma = !!specifier.comma;
    this.precision = specifier.precision === undefined ? undefined : +specifier.precision;
    this.trim = !!specifier.trim;
    this.type = specifier.type === undefined ? "" : specifier.type + "";
  }

  FormatSpecifier.prototype.toString = function() {
    return this.fill
        + this.align
        + this.sign
        + this.symbol
        + (this.zero ? "0" : "")
        + (this.width === undefined ? "" : Math.max(1, this.width | 0))
        + (this.comma ? "," : "")
        + (this.precision === undefined ? "" : "." + Math.max(0, this.precision | 0))
        + (this.trim ? "~" : "")
        + this.type;
  };

  // Trims insignificant zeros, e.g., replaces 1.2000k with 1.2k.
  function formatTrim(s) {
    out: for (var n = s.length, i = 1, i0 = -1, i1; i < n; ++i) {
      switch (s[i]) {
        case ".": i0 = i1 = i; break;
        case "0": if (i0 === 0) i0 = i; i1 = i; break;
        default: if (!+s[i]) break out; if (i0 > 0) i0 = 0; break;
      }
    }
    return i0 > 0 ? s.slice(0, i0) + s.slice(i1 + 1) : s;
  }

  var prefixExponent;

  function formatPrefixAuto(x, p) {
    var d = formatDecimalParts(x, p);
    if (!d) return x + "";
    var coefficient = d[0],
        exponent = d[1],
        i = exponent - (prefixExponent = Math.max(-8, Math.min(8, Math.floor(exponent / 3))) * 3) + 1,
        n = coefficient.length;
    return i === n ? coefficient
        : i > n ? coefficient + new Array(i - n + 1).join("0")
        : i > 0 ? coefficient.slice(0, i) + "." + coefficient.slice(i)
        : "0." + new Array(1 - i).join("0") + formatDecimalParts(x, Math.max(0, p + i - 1))[0]; // less than 1y!
  }

  function formatRounded(x, p) {
    var d = formatDecimalParts(x, p);
    if (!d) return x + "";
    var coefficient = d[0],
        exponent = d[1];
    return exponent < 0 ? "0." + new Array(-exponent).join("0") + coefficient
        : coefficient.length > exponent + 1 ? coefficient.slice(0, exponent + 1) + "." + coefficient.slice(exponent + 1)
        : coefficient + new Array(exponent - coefficient.length + 2).join("0");
  }

  var formatTypes = {
    "%": (x, p) => (x * 100).toFixed(p),
    "b": (x) => Math.round(x).toString(2),
    "c": (x) => x + "",
    "d": formatDecimal,
    "e": (x, p) => x.toExponential(p),
    "f": (x, p) => x.toFixed(p),
    "g": (x, p) => x.toPrecision(p),
    "o": (x) => Math.round(x).toString(8),
    "p": (x, p) => formatRounded(x * 100, p),
    "r": formatRounded,
    "s": formatPrefixAuto,
    "X": (x) => Math.round(x).toString(16).toUpperCase(),
    "x": (x) => Math.round(x).toString(16)
  };

  function identity$1(x) {
    return x;
  }

  var map$1 = Array.prototype.map,
      prefixes = ["y","z","a","f","p","n","µ","m","","k","M","G","T","P","E","Z","Y"];

  function formatLocale$1(locale) {
    var group = locale.grouping === undefined || locale.thousands === undefined ? identity$1 : formatGroup(map$1.call(locale.grouping, Number), locale.thousands + ""),
        currencyPrefix = locale.currency === undefined ? "" : locale.currency[0] + "",
        currencySuffix = locale.currency === undefined ? "" : locale.currency[1] + "",
        decimal = locale.decimal === undefined ? "." : locale.decimal + "",
        numerals = locale.numerals === undefined ? identity$1 : formatNumerals(map$1.call(locale.numerals, String)),
        percent = locale.percent === undefined ? "%" : locale.percent + "",
        minus = locale.minus === undefined ? "−" : locale.minus + "",
        nan = locale.nan === undefined ? "NaN" : locale.nan + "";

    function newFormat(specifier) {
      specifier = formatSpecifier(specifier);

      var fill = specifier.fill,
          align = specifier.align,
          sign = specifier.sign,
          symbol = specifier.symbol,
          zero = specifier.zero,
          width = specifier.width,
          comma = specifier.comma,
          precision = specifier.precision,
          trim = specifier.trim,
          type = specifier.type;

      // The "n" type is an alias for ",g".
      if (type === "n") comma = true, type = "g";

      // The "" type, and any invalid type, is an alias for ".12~g".
      else if (!formatTypes[type]) precision === undefined && (precision = 12), trim = true, type = "g";

      // If zero fill is specified, padding goes after sign and before digits.
      if (zero || (fill === "0" && align === "=")) zero = true, fill = "0", align = "=";

      // Compute the prefix and suffix.
      // For SI-prefix, the suffix is lazily computed.
      var prefix = symbol === "$" ? currencyPrefix : symbol === "#" && /[boxX]/.test(type) ? "0" + type.toLowerCase() : "",
          suffix = symbol === "$" ? currencySuffix : /[%p]/.test(type) ? percent : "";

      // What format function should we use?
      // Is this an integer type?
      // Can this type generate exponential notation?
      var formatType = formatTypes[type],
          maybeSuffix = /[defgprs%]/.test(type);

      // Set the default precision if not specified,
      // or clamp the specified precision to the supported range.
      // For significant precision, it must be in [1, 21].
      // For fixed precision, it must be in [0, 20].
      precision = precision === undefined ? 6
          : /[gprs]/.test(type) ? Math.max(1, Math.min(21, precision))
          : Math.max(0, Math.min(20, precision));

      function format(value) {
        var valuePrefix = prefix,
            valueSuffix = suffix,
            i, n, c;

        if (type === "c") {
          valueSuffix = formatType(value) + valueSuffix;
          value = "";
        } else {
          value = +value;

          // Determine the sign. -0 is not less than 0, but 1 / -0 is!
          var valueNegative = value < 0 || 1 / value < 0;

          // Perform the initial formatting.
          value = isNaN(value) ? nan : formatType(Math.abs(value), precision);

          // Trim insignificant zeros.
          if (trim) value = formatTrim(value);

          // If a negative value rounds to zero after formatting, and no explicit positive sign is requested, hide the sign.
          if (valueNegative && +value === 0 && sign !== "+") valueNegative = false;

          // Compute the prefix and suffix.
          valuePrefix = (valueNegative ? (sign === "(" ? sign : minus) : sign === "-" || sign === "(" ? "" : sign) + valuePrefix;
          valueSuffix = (type === "s" ? prefixes[8 + prefixExponent / 3] : "") + valueSuffix + (valueNegative && sign === "(" ? ")" : "");

          // Break the formatted value into the integer “value” part that can be
          // grouped, and fractional or exponential “suffix” part that is not.
          if (maybeSuffix) {
            i = -1, n = value.length;
            while (++i < n) {
              if (c = value.charCodeAt(i), 48 > c || c > 57) {
                valueSuffix = (c === 46 ? decimal + value.slice(i + 1) : value.slice(i)) + valueSuffix;
                value = value.slice(0, i);
                break;
              }
            }
          }
        }

        // If the fill character is not "0", grouping is applied before padding.
        if (comma && !zero) value = group(value, Infinity);

        // Compute the padding.
        var length = valuePrefix.length + value.length + valueSuffix.length,
            padding = length < width ? new Array(width - length + 1).join(fill) : "";

        // If the fill character is "0", grouping is applied after padding.
        if (comma && zero) value = group(padding + value, padding.length ? width - valueSuffix.length : Infinity), padding = "";

        // Reconstruct the final output based on the desired alignment.
        switch (align) {
          case "<": value = valuePrefix + value + valueSuffix + padding; break;
          case "=": value = valuePrefix + padding + value + valueSuffix; break;
          case "^": value = padding.slice(0, length = padding.length >> 1) + valuePrefix + value + valueSuffix + padding.slice(length); break;
          default: value = padding + valuePrefix + value + valueSuffix; break;
        }

        return numerals(value);
      }

      format.toString = function() {
        return specifier + "";
      };

      return format;
    }

    function formatPrefix(specifier, value) {
      var f = newFormat((specifier = formatSpecifier(specifier), specifier.type = "f", specifier)),
          e = Math.max(-8, Math.min(8, Math.floor(exponent(value) / 3))) * 3,
          k = Math.pow(10, -e),
          prefix = prefixes[8 + e / 3];
      return function(value) {
        return f(k * value) + prefix;
      };
    }

    return {
      format: newFormat,
      formatPrefix: formatPrefix
    };
  }

  var locale$1;
  var format;
  var formatPrefix;

  defaultLocale$1({
    thousands: ",",
    grouping: [3],
    currency: ["$", ""]
  });

  function defaultLocale$1(definition) {
    locale$1 = formatLocale$1(definition);
    format = locale$1.format;
    formatPrefix = locale$1.formatPrefix;
    return locale$1;
  }

  function precisionFixed(step) {
    return Math.max(0, -exponent(Math.abs(step)));
  }

  function precisionPrefix(step, value) {
    return Math.max(0, Math.max(-8, Math.min(8, Math.floor(exponent(value) / 3))) * 3 - exponent(Math.abs(step)));
  }

  function precisionRound(step, max) {
    step = Math.abs(step), max = Math.abs(max) - step;
    return Math.max(0, exponent(max) - exponent(step)) + 1;
  }

  function tickFormat(start, stop, count, specifier) {
    var step = tickStep(start, stop, count),
        precision;
    specifier = formatSpecifier(specifier == null ? ",f" : specifier);
    switch (specifier.type) {
      case "s": {
        var value = Math.max(Math.abs(start), Math.abs(stop));
        if (specifier.precision == null && !isNaN(precision = precisionPrefix(step, value))) specifier.precision = precision;
        return formatPrefix(specifier, value);
      }
      case "":
      case "e":
      case "g":
      case "p":
      case "r": {
        if (specifier.precision == null && !isNaN(precision = precisionRound(step, Math.max(Math.abs(start), Math.abs(stop))))) specifier.precision = precision - (specifier.type === "e");
        break;
      }
      case "f":
      case "%": {
        if (specifier.precision == null && !isNaN(precision = precisionFixed(step))) specifier.precision = precision - (specifier.type === "%") * 2;
        break;
      }
    }
    return format(specifier);
  }

  function linearish(scale) {
    var domain = scale.domain;

    scale.ticks = function(count) {
      var d = domain();
      return ticks(d[0], d[d.length - 1], count == null ? 10 : count);
    };

    scale.tickFormat = function(count, specifier) {
      var d = domain();
      return tickFormat(d[0], d[d.length - 1], count == null ? 10 : count, specifier);
    };

    scale.nice = function(count) {
      if (count == null) count = 10;

      var d = domain();
      var i0 = 0;
      var i1 = d.length - 1;
      var start = d[i0];
      var stop = d[i1];
      var prestep;
      var step;
      var maxIter = 10;

      if (stop < start) {
        step = start, start = stop, stop = step;
        step = i0, i0 = i1, i1 = step;
      }
      
      while (maxIter-- > 0) {
        step = tickIncrement(start, stop, count);
        if (step === prestep) {
          d[i0] = start;
          d[i1] = stop;
          return domain(d);
        } else if (step > 0) {
          start = Math.floor(start / step) * step;
          stop = Math.ceil(stop / step) * step;
        } else if (step < 0) {
          start = Math.ceil(start * step) / step;
          stop = Math.floor(stop * step) / step;
        } else {
          break;
        }
        prestep = step;
      }

      return scale;
    };

    return scale;
  }

  function linear$1() {
    var scale = continuous();

    scale.copy = function() {
      return copy$1(scale, linear$1());
    };

    initRange.apply(scale, arguments);

    return linearish(scale);
  }

  function identity$2(domain) {
    var unknown;

    function scale(x) {
      return isNaN(x = +x) ? unknown : x;
    }

    scale.invert = scale;

    scale.domain = scale.range = function(_) {
      return arguments.length ? (domain = Array.from(_, number$1), scale) : domain.slice();
    };

    scale.unknown = function(_) {
      return arguments.length ? (unknown = _, scale) : unknown;
    };

    scale.copy = function() {
      return identity$2(domain).unknown(unknown);
    };

    domain = arguments.length ? Array.from(domain, number$1) : [0, 1];

    return linearish(scale);
  }

  function nice(domain, interval) {
    domain = domain.slice();

    var i0 = 0,
        i1 = domain.length - 1,
        x0 = domain[i0],
        x1 = domain[i1],
        t;

    if (x1 < x0) {
      t = i0, i0 = i1, i1 = t;
      t = x0, x0 = x1, x1 = t;
    }

    domain[i0] = interval.floor(x0);
    domain[i1] = interval.ceil(x1);
    return domain;
  }

  function transformLog(x) {
    return Math.log(x);
  }

  function transformExp(x) {
    return Math.exp(x);
  }

  function transformLogn(x) {
    return -Math.log(-x);
  }

  function transformExpn(x) {
    return -Math.exp(-x);
  }

  function pow10(x) {
    return isFinite(x) ? +("1e" + x) : x < 0 ? 0 : x;
  }

  function powp(base) {
    return base === 10 ? pow10
        : base === Math.E ? Math.exp
        : function(x) { return Math.pow(base, x); };
  }

  function logp(base) {
    return base === Math.E ? Math.log
        : base === 10 && Math.log10
        || base === 2 && Math.log2
        || (base = Math.log(base), function(x) { return Math.log(x) / base; });
  }

  function reflect(f) {
    return function(x) {
      return -f(-x);
    };
  }

  function loggish(transform) {
    var scale = transform(transformLog, transformExp),
        domain = scale.domain,
        base = 10,
        logs,
        pows;

    function rescale() {
      logs = logp(base), pows = powp(base);
      if (domain()[0] < 0) {
        logs = reflect(logs), pows = reflect(pows);
        transform(transformLogn, transformExpn);
      } else {
        transform(transformLog, transformExp);
      }
      return scale;
    }

    scale.base = function(_) {
      return arguments.length ? (base = +_, rescale()) : base;
    };

    scale.domain = function(_) {
      return arguments.length ? (domain(_), rescale()) : domain();
    };

    scale.ticks = function(count) {
      var d = domain(),
          u = d[0],
          v = d[d.length - 1],
          r;

      if (r = v < u) i = u, u = v, v = i;

      var i = logs(u),
          j = logs(v),
          p,
          k,
          t,
          n = count == null ? 10 : +count,
          z = [];

      if (!(base % 1) && j - i < n) {
        i = Math.floor(i), j = Math.ceil(j);
        if (u > 0) for (; i <= j; ++i) {
          for (k = 1, p = pows(i); k < base; ++k) {
            t = p * k;
            if (t < u) continue;
            if (t > v) break;
            z.push(t);
          }
        } else for (; i <= j; ++i) {
          for (k = base - 1, p = pows(i); k >= 1; --k) {
            t = p * k;
            if (t < u) continue;
            if (t > v) break;
            z.push(t);
          }
        }
        if (z.length * 2 < n) z = ticks(u, v, n);
      } else {
        z = ticks(i, j, Math.min(j - i, n)).map(pows);
      }

      return r ? z.reverse() : z;
    };

    scale.tickFormat = function(count, specifier) {
      if (specifier == null) specifier = base === 10 ? ".0e" : ",";
      if (typeof specifier !== "function") specifier = format(specifier);
      if (count === Infinity) return specifier;
      if (count == null) count = 10;
      var k = Math.max(1, base * count / scale.ticks().length); // TODO fast estimate?
      return function(d) {
        var i = d / pows(Math.round(logs(d)));
        if (i * base < base - 0.5) i *= base;
        return i <= k ? specifier(d) : "";
      };
    };

    scale.nice = function() {
      return domain(nice(domain(), {
        floor: function(x) { return pows(Math.floor(logs(x))); },
        ceil: function(x) { return pows(Math.ceil(logs(x))); }
      }));
    };

    return scale;
  }

  function log() {
    var scale = loggish(transformer()).domain([1, 10]);

    scale.copy = function() {
      return copy$1(scale, log()).base(scale.base());
    };

    initRange.apply(scale, arguments);

    return scale;
  }

  function transformSymlog(c) {
    return function(x) {
      return Math.sign(x) * Math.log1p(Math.abs(x / c));
    };
  }

  function transformSymexp(c) {
    return function(x) {
      return Math.sign(x) * Math.expm1(Math.abs(x)) * c;
    };
  }

  function symlogish(transform) {
    var c = 1, scale = transform(transformSymlog(c), transformSymexp(c));

    scale.constant = function(_) {
      return arguments.length ? transform(transformSymlog(c = +_), transformSymexp(c)) : c;
    };

    return linearish(scale);
  }

  function symlog() {
    var scale = symlogish(transformer());

    scale.copy = function() {
      return copy$1(scale, symlog()).constant(scale.constant());
    };

    return initRange.apply(scale, arguments);
  }

  function transformPow(exponent) {
    return function(x) {
      return x < 0 ? -Math.pow(-x, exponent) : Math.pow(x, exponent);
    };
  }

  function transformSqrt(x) {
    return x < 0 ? -Math.sqrt(-x) : Math.sqrt(x);
  }

  function transformSquare(x) {
    return x < 0 ? -x * x : x * x;
  }

  function powish(transform) {
    var scale = transform(identity, identity),
        exponent = 1;

    function rescale() {
      return exponent === 1 ? transform(identity, identity)
          : exponent === 0.5 ? transform(transformSqrt, transformSquare)
          : transform(transformPow(exponent), transformPow(1 / exponent));
    }

    scale.exponent = function(_) {
      return arguments.length ? (exponent = +_, rescale()) : exponent;
    };

    return linearish(scale);
  }

  function pow() {
    var scale = powish(transformer());

    scale.copy = function() {
      return copy$1(scale, pow()).exponent(scale.exponent());
    };

    initRange.apply(scale, arguments);

    return scale;
  }

  function sqrt() {
    return pow.apply(null, arguments).exponent(0.5);
  }

  function square(x) {
    return Math.sign(x) * x * x;
  }

  function unsquare(x) {
    return Math.sign(x) * Math.sqrt(Math.abs(x));
  }

  function radial() {
    var squared = continuous(),
        range = [0, 1],
        round = false,
        unknown;

    function scale(x) {
      var y = unsquare(squared(x));
      return isNaN(y) ? unknown : round ? Math.round(y) : y;
    }

    scale.invert = function(y) {
      return squared.invert(square(y));
    };

    scale.domain = function(_) {
      return arguments.length ? (squared.domain(_), scale) : squared.domain();
    };

    scale.range = function(_) {
      return arguments.length ? (squared.range((range = Array.from(_, number$1)).map(square)), scale) : range.slice();
    };

    scale.rangeRound = function(_) {
      return scale.range(_).round(true);
    };

    scale.round = function(_) {
      return arguments.length ? (round = !!_, scale) : round;
    };

    scale.clamp = function(_) {
      return arguments.length ? (squared.clamp(_), scale) : squared.clamp();
    };

    scale.unknown = function(_) {
      return arguments.length ? (unknown = _, scale) : unknown;
    };

    scale.copy = function() {
      return radial(squared.domain(), range)
          .round(round)
          .clamp(squared.clamp())
          .unknown(unknown);
    };

    initRange.apply(scale, arguments);

    return linearish(scale);
  }

  function quantile$1() {
    var domain = [],
        range = [],
        thresholds = [],
        unknown;

    function rescale() {
      var i = 0, n = Math.max(1, range.length);
      thresholds = new Array(n - 1);
      while (++i < n) thresholds[i - 1] = quantileSorted(domain, i / n);
      return scale;
    }

    function scale(x) {
      return isNaN(x = +x) ? unknown : range[bisectRight(thresholds, x)];
    }

    scale.invertExtent = function(y) {
      var i = range.indexOf(y);
      return i < 0 ? [NaN, NaN] : [
        i > 0 ? thresholds[i - 1] : domain[0],
        i < thresholds.length ? thresholds[i] : domain[domain.length - 1]
      ];
    };

    scale.domain = function(_) {
      if (!arguments.length) return domain.slice();
      domain = [];
      for (let d of _) if (d != null && !isNaN(d = +d)) domain.push(d);
      domain.sort(ascending);
      return rescale();
    };

    scale.range = function(_) {
      return arguments.length ? (range = Array.from(_), rescale()) : range.slice();
    };

    scale.unknown = function(_) {
      return arguments.length ? (unknown = _, scale) : unknown;
    };

    scale.quantiles = function() {
      return thresholds.slice();
    };

    scale.copy = function() {
      return quantile$1()
          .domain(domain)
          .range(range)
          .unknown(unknown);
    };

    return initRange.apply(scale, arguments);
  }

  function quantize() {
    var x0 = 0,
        x1 = 1,
        n = 1,
        domain = [0.5],
        range = [0, 1],
        unknown;

    function scale(x) {
      return x <= x ? range[bisectRight(domain, x, 0, n)] : unknown;
    }

    function rescale() {
      var i = -1;
      domain = new Array(n);
      while (++i < n) domain[i] = ((i + 1) * x1 - (i - n) * x0) / (n + 1);
      return scale;
    }

    scale.domain = function(_) {
      return arguments.length ? ([x0, x1] = _, x0 = +x0, x1 = +x1, rescale()) : [x0, x1];
    };

    scale.range = function(_) {
      return arguments.length ? (n = (range = Array.from(_)).length - 1, rescale()) : range.slice();
    };

    scale.invertExtent = function(y) {
      var i = range.indexOf(y);
      return i < 0 ? [NaN, NaN]
          : i < 1 ? [x0, domain[0]]
          : i >= n ? [domain[n - 1], x1]
          : [domain[i - 1], domain[i]];
    };

    scale.unknown = function(_) {
      return arguments.length ? (unknown = _, scale) : scale;
    };

    scale.thresholds = function() {
      return domain.slice();
    };

    scale.copy = function() {
      return quantize()
          .domain([x0, x1])
          .range(range)
          .unknown(unknown);
    };

    return initRange.apply(linearish(scale), arguments);
  }

  function threshold() {
    var domain = [0.5],
        range = [0, 1],
        unknown,
        n = 1;

    function scale(x) {
      return x <= x ? range[bisectRight(domain, x, 0, n)] : unknown;
    }

    scale.domain = function(_) {
      return arguments.length ? (domain = Array.from(_), n = Math.min(domain.length, range.length - 1), scale) : domain.slice();
    };

    scale.range = function(_) {
      return arguments.length ? (range = Array.from(_), n = Math.min(domain.length, range.length - 1), scale) : range.slice();
    };

    scale.invertExtent = function(y) {
      var i = range.indexOf(y);
      return [domain[i - 1], domain[i]];
    };

    scale.unknown = function(_) {
      return arguments.length ? (unknown = _, scale) : unknown;
    };

    scale.copy = function() {
      return threshold()
          .domain(domain)
          .range(range)
          .unknown(unknown);
    };

    return initRange.apply(scale, arguments);
  }

  var t0$1 = new Date,
      t1$1 = new Date;

  function newInterval$1(floori, offseti, count, field) {

    function interval(date) {
      return floori(date = arguments.length === 0 ? new Date : new Date(+date)), date;
    }

    interval.floor = function(date) {
      return floori(date = new Date(+date)), date;
    };

    interval.ceil = function(date) {
      return floori(date = new Date(date - 1)), offseti(date, 1), floori(date), date;
    };

    interval.round = function(date) {
      var d0 = interval(date),
          d1 = interval.ceil(date);
      return date - d0 < d1 - date ? d0 : d1;
    };

    interval.offset = function(date, step) {
      return offseti(date = new Date(+date), step == null ? 1 : Math.floor(step)), date;
    };

    interval.range = function(start, stop, step) {
      var range = [], previous;
      start = interval.ceil(start);
      step = step == null ? 1 : Math.floor(step);
      if (!(start < stop) || !(step > 0)) return range; // also handles Invalid Date
      do range.push(previous = new Date(+start)), offseti(start, step), floori(start);
      while (previous < start && start < stop);
      return range;
    };

    interval.filter = function(test) {
      return newInterval$1(function(date) {
        if (date >= date) while (floori(date), !test(date)) date.setTime(date - 1);
      }, function(date, step) {
        if (date >= date) {
          if (step < 0) while (++step <= 0) {
            while (offseti(date, -1), !test(date)) {} // eslint-disable-line no-empty
          } else while (--step >= 0) {
            while (offseti(date, +1), !test(date)) {} // eslint-disable-line no-empty
          }
        }
      });
    };

    if (count) {
      interval.count = function(start, end) {
        t0$1.setTime(+start), t1$1.setTime(+end);
        floori(t0$1), floori(t1$1);
        return Math.floor(count(t0$1, t1$1));
      };

      interval.every = function(step) {
        step = Math.floor(step);
        return !isFinite(step) || !(step > 0) ? null
            : !(step > 1) ? interval
            : interval.filter(field
                ? function(d) { return field(d) % step === 0; }
                : function(d) { return interval.count(0, d) % step === 0; });
      };
    }

    return interval;
  }

  var millisecond = newInterval$1(function() {
    // noop
  }, function(date, step) {
    date.setTime(+date + step);
  }, function(start, end) {
    return end - start;
  });

  // An optimized implementation for this simple case.
  millisecond.every = function(k) {
    k = Math.floor(k);
    if (!isFinite(k) || !(k > 0)) return null;
    if (!(k > 1)) return millisecond;
    return newInterval$1(function(date) {
      date.setTime(Math.floor(date / k) * k);
    }, function(date, step) {
      date.setTime(+date + step * k);
    }, function(start, end) {
      return (end - start) / k;
    });
  };

  var durationSecond = 1e3;
  var durationMinute$1 = 6e4;
  var durationHour = 36e5;
  var durationDay$1 = 864e5;
  var durationWeek$1 = 6048e5;

  var second = newInterval$1(function(date) {
    date.setTime(date - date.getMilliseconds());
  }, function(date, step) {
    date.setTime(+date + step * durationSecond);
  }, function(start, end) {
    return (end - start) / durationSecond;
  }, function(date) {
    return date.getUTCSeconds();
  });

  var minute = newInterval$1(function(date) {
    date.setTime(date - date.getMilliseconds() - date.getSeconds() * durationSecond);
  }, function(date, step) {
    date.setTime(+date + step * durationMinute$1);
  }, function(start, end) {
    return (end - start) / durationMinute$1;
  }, function(date) {
    return date.getMinutes();
  });

  var hour = newInterval$1(function(date) {
    date.setTime(date - date.getMilliseconds() - date.getSeconds() * durationSecond - date.getMinutes() * durationMinute$1);
  }, function(date, step) {
    date.setTime(+date + step * durationHour);
  }, function(start, end) {
    return (end - start) / durationHour;
  }, function(date) {
    return date.getHours();
  });

  var day$1 = newInterval$1(
    date => date.setHours(0, 0, 0, 0),
    (date, step) => date.setDate(date.getDate() + step),
    (start, end) => (end - start - (end.getTimezoneOffset() - start.getTimezoneOffset()) * durationMinute$1) / durationDay$1,
    date => date.getDate() - 1
  );

  function weekday$1(i) {
    return newInterval$1(function(date) {
      date.setDate(date.getDate() - (date.getDay() + 7 - i) % 7);
      date.setHours(0, 0, 0, 0);
    }, function(date, step) {
      date.setDate(date.getDate() + step * 7);
    }, function(start, end) {
      return (end - start - (end.getTimezoneOffset() - start.getTimezoneOffset()) * durationMinute$1) / durationWeek$1;
    });
  }

  var sunday$1 = weekday$1(0);
  var monday$1 = weekday$1(1);
  var tuesday$1 = weekday$1(2);
  var wednesday$1 = weekday$1(3);
  var thursday$1 = weekday$1(4);
  var friday$1 = weekday$1(5);
  var saturday$1 = weekday$1(6);

  var month = newInterval$1(function(date) {
    date.setDate(1);
    date.setHours(0, 0, 0, 0);
  }, function(date, step) {
    date.setMonth(date.getMonth() + step);
  }, function(start, end) {
    return end.getMonth() - start.getMonth() + (end.getFullYear() - start.getFullYear()) * 12;
  }, function(date) {
    return date.getMonth();
  });

  var year$1 = newInterval$1(function(date) {
    date.setMonth(0, 1);
    date.setHours(0, 0, 0, 0);
  }, function(date, step) {
    date.setFullYear(date.getFullYear() + step);
  }, function(start, end) {
    return end.getFullYear() - start.getFullYear();
  }, function(date) {
    return date.getFullYear();
  });

  // An optimized implementation for this simple case.
  year$1.every = function(k) {
    return !isFinite(k = Math.floor(k)) || !(k > 0) ? null : newInterval$1(function(date) {
      date.setFullYear(Math.floor(date.getFullYear() / k) * k);
      date.setMonth(0, 1);
      date.setHours(0, 0, 0, 0);
    }, function(date, step) {
      date.setFullYear(date.getFullYear() + step * k);
    });
  };

  var utcMinute = newInterval$1(function(date) {
    date.setUTCSeconds(0, 0);
  }, function(date, step) {
    date.setTime(+date + step * durationMinute$1);
  }, function(start, end) {
    return (end - start) / durationMinute$1;
  }, function(date) {
    return date.getUTCMinutes();
  });

  var utcHour = newInterval$1(function(date) {
    date.setUTCMinutes(0, 0, 0);
  }, function(date, step) {
    date.setTime(+date + step * durationHour);
  }, function(start, end) {
    return (end - start) / durationHour;
  }, function(date) {
    return date.getUTCHours();
  });

  var utcDay$1 = newInterval$1(function(date) {
    date.setUTCHours(0, 0, 0, 0);
  }, function(date, step) {
    date.setUTCDate(date.getUTCDate() + step);
  }, function(start, end) {
    return (end - start) / durationDay$1;
  }, function(date) {
    return date.getUTCDate() - 1;
  });

  function utcWeekday$1(i) {
    return newInterval$1(function(date) {
      date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 7 - i) % 7);
      date.setUTCHours(0, 0, 0, 0);
    }, function(date, step) {
      date.setUTCDate(date.getUTCDate() + step * 7);
    }, function(start, end) {
      return (end - start) / durationWeek$1;
    });
  }

  var utcSunday$1 = utcWeekday$1(0);
  var utcMonday$1 = utcWeekday$1(1);
  var utcTuesday$1 = utcWeekday$1(2);
  var utcWednesday$1 = utcWeekday$1(3);
  var utcThursday$1 = utcWeekday$1(4);
  var utcFriday$1 = utcWeekday$1(5);
  var utcSaturday$1 = utcWeekday$1(6);

  var utcMonth = newInterval$1(function(date) {
    date.setUTCDate(1);
    date.setUTCHours(0, 0, 0, 0);
  }, function(date, step) {
    date.setUTCMonth(date.getUTCMonth() + step);
  }, function(start, end) {
    return end.getUTCMonth() - start.getUTCMonth() + (end.getUTCFullYear() - start.getUTCFullYear()) * 12;
  }, function(date) {
    return date.getUTCMonth();
  });

  var utcYear$1 = newInterval$1(function(date) {
    date.setUTCMonth(0, 1);
    date.setUTCHours(0, 0, 0, 0);
  }, function(date, step) {
    date.setUTCFullYear(date.getUTCFullYear() + step);
  }, function(start, end) {
    return end.getUTCFullYear() - start.getUTCFullYear();
  }, function(date) {
    return date.getUTCFullYear();
  });

  // An optimized implementation for this simple case.
  utcYear$1.every = function(k) {
    return !isFinite(k = Math.floor(k)) || !(k > 0) ? null : newInterval$1(function(date) {
      date.setUTCFullYear(Math.floor(date.getUTCFullYear() / k) * k);
      date.setUTCMonth(0, 1);
      date.setUTCHours(0, 0, 0, 0);
    }, function(date, step) {
      date.setUTCFullYear(date.getUTCFullYear() + step * k);
    });
  };

  var durationSecond$1 = 1000,
      durationMinute$2 = durationSecond$1 * 60,
      durationHour$1 = durationMinute$2 * 60,
      durationDay$2 = durationHour$1 * 24,
      durationWeek$2 = durationDay$2 * 7,
      durationMonth = durationDay$2 * 30,
      durationYear = durationDay$2 * 365;

  function date$1(t) {
    return new Date(t);
  }

  function number$2(t) {
    return t instanceof Date ? +t : +new Date(+t);
  }

  function calendar(year, month, week, day, hour, minute, second, millisecond, format) {
    var scale = continuous(),
        invert = scale.invert,
        domain = scale.domain;

    var formatMillisecond = format(".%L"),
        formatSecond = format(":%S"),
        formatMinute = format("%I:%M"),
        formatHour = format("%I %p"),
        formatDay = format("%a %d"),
        formatWeek = format("%b %d"),
        formatMonth = format("%B"),
        formatYear = format("%Y");

    var tickIntervals = [
      [second,  1,      durationSecond$1],
      [second,  5,  5 * durationSecond$1],
      [second, 15, 15 * durationSecond$1],
      [second, 30, 30 * durationSecond$1],
      [minute,  1,      durationMinute$2],
      [minute,  5,  5 * durationMinute$2],
      [minute, 15, 15 * durationMinute$2],
      [minute, 30, 30 * durationMinute$2],
      [  hour,  1,      durationHour$1  ],
      [  hour,  3,  3 * durationHour$1  ],
      [  hour,  6,  6 * durationHour$1  ],
      [  hour, 12, 12 * durationHour$1  ],
      [   day,  1,      durationDay$2   ],
      [   day,  2,  2 * durationDay$2   ],
      [  week,  1,      durationWeek$2  ],
      [ month,  1,      durationMonth ],
      [ month,  3,  3 * durationMonth ],
      [  year,  1,      durationYear  ]
    ];

    function tickFormat(date) {
      return (second(date) < date ? formatMillisecond
          : minute(date) < date ? formatSecond
          : hour(date) < date ? formatMinute
          : day(date) < date ? formatHour
          : month(date) < date ? (week(date) < date ? formatDay : formatWeek)
          : year(date) < date ? formatMonth
          : formatYear)(date);
    }

    function tickInterval(interval, start, stop) {
      if (interval == null) interval = 10;

      // If a desired tick count is specified, pick a reasonable tick interval
      // based on the extent of the domain and a rough estimate of tick size.
      // Otherwise, assume interval is already a time interval and use it.
      if (typeof interval === "number") {
        var target = Math.abs(stop - start) / interval,
            i = bisector(function(i) { return i[2]; }).right(tickIntervals, target),
            step;
        if (i === tickIntervals.length) {
          step = tickStep(start / durationYear, stop / durationYear, interval);
          interval = year;
        } else if (i) {
          i = tickIntervals[target / tickIntervals[i - 1][2] < tickIntervals[i][2] / target ? i - 1 : i];
          step = i[1];
          interval = i[0];
        } else {
          step = Math.max(tickStep(start, stop, interval), 1);
          interval = millisecond;
        }
        return interval.every(step);
      }

      return interval;
    }

    scale.invert = function(y) {
      return new Date(invert(y));
    };

    scale.domain = function(_) {
      return arguments.length ? domain(Array.from(_, number$2)) : domain().map(date$1);
    };

    scale.ticks = function(interval) {
      var d = domain(),
          t0 = d[0],
          t1 = d[d.length - 1],
          r = t1 < t0,
          t;
      if (r) t = t0, t0 = t1, t1 = t;
      t = tickInterval(interval, t0, t1);
      t = t ? t.range(t0, t1 + 1) : []; // inclusive stop
      return r ? t.reverse() : t;
    };

    scale.tickFormat = function(count, specifier) {
      return specifier == null ? tickFormat : format(specifier);
    };

    scale.nice = function(interval) {
      var d = domain();
      return (interval = tickInterval(interval, d[0], d[d.length - 1]))
          ? domain(nice(d, interval))
          : scale;
    };

    scale.copy = function() {
      return copy$1(scale, calendar(year, month, week, day, hour, minute, second, millisecond, format));
    };

    return scale;
  }

  function time() {
    return initRange.apply(calendar(year$1, month, sunday$1, day$1, hour, minute, second, millisecond, timeFormat).domain([new Date(2000, 0, 1), new Date(2000, 0, 2)]), arguments);
  }

  function utcTime() {
    return initRange.apply(calendar(utcYear$1, utcMonth, utcSunday$1, utcDay$1, utcHour, utcMinute, second, millisecond, utcFormat).domain([Date.UTC(2000, 0, 1), Date.UTC(2000, 0, 2)]), arguments);
  }

  function transformer$1() {
    var x0 = 0,
        x1 = 1,
        t0,
        t1,
        k10,
        transform,
        interpolator = identity,
        clamp = false,
        unknown;

    function scale(x) {
      return isNaN(x = +x) ? unknown : interpolator(k10 === 0 ? 0.5 : (x = (transform(x) - t0) * k10, clamp ? Math.max(0, Math.min(1, x)) : x));
    }

    scale.domain = function(_) {
      return arguments.length ? ([x0, x1] = _, t0 = transform(x0 = +x0), t1 = transform(x1 = +x1), k10 = t0 === t1 ? 0 : 1 / (t1 - t0), scale) : [x0, x1];
    };

    scale.clamp = function(_) {
      return arguments.length ? (clamp = !!_, scale) : clamp;
    };

    scale.interpolator = function(_) {
      return arguments.length ? (interpolator = _, scale) : interpolator;
    };

    function range(interpolate) {
      return function(_) {
        var r0, r1;
        return arguments.length ? ([r0, r1] = _, interpolator = interpolate(r0, r1), scale) : [interpolator(0), interpolator(1)];
      };
    }

    scale.range = range(interpolate$1);

    scale.rangeRound = range(interpolateRound);

    scale.unknown = function(_) {
      return arguments.length ? (unknown = _, scale) : unknown;
    };

    return function(t) {
      transform = t, t0 = t(x0), t1 = t(x1), k10 = t0 === t1 ? 0 : 1 / (t1 - t0);
      return scale;
    };
  }

  function copy$2(source, target) {
    return target
        .domain(source.domain())
        .interpolator(source.interpolator())
        .clamp(source.clamp())
        .unknown(source.unknown());
  }

  function sequential() {
    var scale = linearish(transformer$1()(identity));

    scale.copy = function() {
      return copy$2(scale, sequential());
    };

    return initInterpolator.apply(scale, arguments);
  }

  function sequentialLog() {
    var scale = loggish(transformer$1()).domain([1, 10]);

    scale.copy = function() {
      return copy$2(scale, sequentialLog()).base(scale.base());
    };

    return initInterpolator.apply(scale, arguments);
  }

  function sequentialSymlog() {
    var scale = symlogish(transformer$1());

    scale.copy = function() {
      return copy$2(scale, sequentialSymlog()).constant(scale.constant());
    };

    return initInterpolator.apply(scale, arguments);
  }

  function sequentialPow() {
    var scale = powish(transformer$1());

    scale.copy = function() {
      return copy$2(scale, sequentialPow()).exponent(scale.exponent());
    };

    return initInterpolator.apply(scale, arguments);
  }

  function sequentialSqrt() {
    return sequentialPow.apply(null, arguments).exponent(0.5);
  }

  function sequentialQuantile() {
    var domain = [],
        interpolator = identity;

    function scale(x) {
      if (!isNaN(x = +x)) return interpolator((bisectRight(domain, x, 1) - 1) / (domain.length - 1));
    }

    scale.domain = function(_) {
      if (!arguments.length) return domain.slice();
      domain = [];
      for (let d of _) if (d != null && !isNaN(d = +d)) domain.push(d);
      domain.sort(ascending);
      return scale;
    };

    scale.interpolator = function(_) {
      return arguments.length ? (interpolator = _, scale) : interpolator;
    };

    scale.range = function() {
      return domain.map((d, i) => interpolator(i / (domain.length - 1)));
    };

    scale.quantiles = function(n) {
      return Array.from({length: n + 1}, (_, i) => quantile(domain, i / n));
    };

    scale.copy = function() {
      return sequentialQuantile(interpolator).domain(domain);
    };

    return initInterpolator.apply(scale, arguments);
  }

  function transformer$2() {
    var x0 = 0,
        x1 = 0.5,
        x2 = 1,
        s = 1,
        t0,
        t1,
        t2,
        k10,
        k21,
        interpolator = identity,
        transform,
        clamp = false,
        unknown;

    function scale(x) {
      return isNaN(x = +x) ? unknown : (x = 0.5 + ((x = +transform(x)) - t1) * (s * x < s * t1 ? k10 : k21), interpolator(clamp ? Math.max(0, Math.min(1, x)) : x));
    }

    scale.domain = function(_) {
      return arguments.length ? ([x0, x1, x2] = _, t0 = transform(x0 = +x0), t1 = transform(x1 = +x1), t2 = transform(x2 = +x2), k10 = t0 === t1 ? 0 : 0.5 / (t1 - t0), k21 = t1 === t2 ? 0 : 0.5 / (t2 - t1), s = t1 < t0 ? -1 : 1, scale) : [x0, x1, x2];
    };

    scale.clamp = function(_) {
      return arguments.length ? (clamp = !!_, scale) : clamp;
    };

    scale.interpolator = function(_) {
      return arguments.length ? (interpolator = _, scale) : interpolator;
    };

    function range(interpolate) {
      return function(_) {
        var r0, r1, r2;
        return arguments.length ? ([r0, r1, r2] = _, interpolator = piecewise(interpolate, [r0, r1, r2]), scale) : [interpolator(0), interpolator(0.5), interpolator(1)];
      };
    }

    scale.range = range(interpolate$1);

    scale.rangeRound = range(interpolateRound);

    scale.unknown = function(_) {
      return arguments.length ? (unknown = _, scale) : unknown;
    };

    return function(t) {
      transform = t, t0 = t(x0), t1 = t(x1), t2 = t(x2), k10 = t0 === t1 ? 0 : 0.5 / (t1 - t0), k21 = t1 === t2 ? 0 : 0.5 / (t2 - t1), s = t1 < t0 ? -1 : 1;
      return scale;
    };
  }

  function diverging() {
    var scale = linearish(transformer$2()(identity));

    scale.copy = function() {
      return copy$2(scale, diverging());
    };

    return initInterpolator.apply(scale, arguments);
  }

  function divergingLog() {
    var scale = loggish(transformer$2()).domain([0.1, 1, 10]);

    scale.copy = function() {
      return copy$2(scale, divergingLog()).base(scale.base());
    };

    return initInterpolator.apply(scale, arguments);
  }

  function divergingSymlog() {
    var scale = symlogish(transformer$2());

    scale.copy = function() {
      return copy$2(scale, divergingSymlog()).constant(scale.constant());
    };

    return initInterpolator.apply(scale, arguments);
  }

  function divergingPow() {
    var scale = powish(transformer$2());

    scale.copy = function() {
      return copy$2(scale, divergingPow()).exponent(scale.exponent());
    };

    return initInterpolator.apply(scale, arguments);
  }

  function divergingSqrt() {
    return divergingPow.apply(null, arguments).exponent(0.5);
  }



  var d3$2 = /*#__PURE__*/Object.freeze({
    __proto__: null,
    scaleBand: band,
    scalePoint: point,
    scaleIdentity: identity$2,
    scaleLinear: linear$1,
    scaleLog: log,
    scaleSymlog: symlog,
    scaleOrdinal: ordinal,
    scaleImplicit: implicit,
    scalePow: pow,
    scaleSqrt: sqrt,
    scaleRadial: radial,
    scaleQuantile: quantile$1,
    scaleQuantize: quantize,
    scaleThreshold: threshold,
    scaleTime: time,
    scaleUtc: utcTime,
    scaleSequential: sequential,
    scaleSequentialLog: sequentialLog,
    scaleSequentialPow: sequentialPow,
    scaleSequentialSqrt: sequentialSqrt,
    scaleSequentialSymlog: sequentialSymlog,
    scaleSequentialQuantile: sequentialQuantile,
    scaleDiverging: diverging,
    scaleDivergingLog: divergingLog,
    scaleDivergingPow: divergingPow,
    scaleDivergingSqrt: divergingSqrt,
    scaleDivergingSymlog: divergingSymlog,
    tickFormat: tickFormat
  });

  const scales = {
      "linear": linear$1,
      "log": log,
      "sqrt": sqrt,
      "ordinal": ordinal,
      "point": point,
      "band": band,
      "time": utcTime
  };


  const defaultConfig$1 = {
      domain: null,
      range: null,
      type: null
  };

  const defaults$2 = {
      domain: [0,1]
  };

  function baseScale(config = {}, parent) {

      applyDefaults(config, defaultConfig$1);

      console.log('creating new scale for', parent.name);

      return {
          config,
          parent,
          // ordinal, point or band
          ordinalScale: "ordinal",
          get path() {
              this.parent.path + '.' + name;
          },
          name: 'scale',
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
              else if (concept && ["time"].includes(concept.concept_type))
                  scaleType = "time";
              else
                  scaleType = "linear";
              return scaleType;
          },
          get range() {
              console.log('range',this.parent.name);
              if (this.config.range != null)
                  return this.config.range

              // default for constant is identity
              if (this.data.isConstant())
                  return this.domain;

              // default
              return (this.type == "ordinal") ?
                  undefined : [0, 1];
          },
          set range(range) {
              this.config.range = range;
          },
          get domain() {
              return this.config.domain ? this.config.domain.map(c => parseConfigValue(c, this.data.conceptProps))
                  : this.data.domain ? this.data.domain
                  : defaults$2.domain;
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

  function colors(specifier) {
    var n = specifier.length / 6 | 0, colors = new Array(n), i = 0;
    while (i < n) colors[i] = "#" + specifier.slice(i * 6, ++i * 6);
    return colors;
  }

  var category10 = colors("1f77b4ff7f0e2ca02cd627289467bd8c564be377c27f7f7fbcbd2217becf");

  const colors$1 = {
      schemeCategory10: category10
  };

  function color$1(config, parent) {

      const s = baseScale(config, parent);

      return assign(s, {
          get range() {
              const range = this.config.range;
              if (Array.isArray(range))
                  return range;
              
              if (isString(range) && colors$1[range])
                  return colors$1[range];

              if (this.type == "ordinal")
                  return category10;

              return ["red", "green"];
          }
      });
  }

  const defaultConfig$2 = {
      type: "sqrt",
      range: [0, 20]
  };

  function size(config, parent) {

      applyDefaults(config, defaultConfig$2);
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
      color: color$1,
      size,
  });

  const defaults$3 = {
      scale: {},
      data: {}
  };

  const functions = {
      get defaultConfig() {
          let cfg = Object.assign({ 
              scale: this.scale.defaultConfig, 
              data: this.data.defaultConfig,
          }, defaults$3);
          return cfg;
      },
      get marker() {
          //trace();
          return this.parent;
      },
      get name() {
          return this.marker.getEncodingName(this);
      },
      get path() {
          return this.marker.path + '.encoding.' + this.name;
      },   
      get data() {
          const data = this.config.data || defaults$3.data;
          return dataConfigStore.get(data, this);
      },
      get scale() {
          console.warn('recalculating scale', this.name);
          const scale = this.config.scale || defaults$3.scale;
          return scaleStore.get(scale, this);
      },
      setWhich: mobx.action('setWhich', function(kv) {
          const concept = this.data.source.getConcept(kv.value.concept);

          this.config.data.concept = concept.concept;
          this.config.data.space = kv.key;
          this.config.scale.domain = null;
          this.config.scale.type = null;
      })
  };

  function encoding(config, parent, name) {
      //console.warn('creating new encoding', name, config);
      return assign({}, functions, configurable, { config, parent });
  }

  const defaultConfig$3 = {
      modelType: "frame",
      value: null,
      loop: false
  };

  const defaults$4 = {
      interpolate: true,
      loop: false,
      playbackSteps: 1,
      speed: 100
  };

  const functions$1 = {
      get value() {
          let value;

          if (this.config.value != null) {
              value = parseConfigValue(this.config.value, this.data.conceptProps);
              value = this.scale.clampToDomain(value);
          } else {
              value = this.scale.domain[0];
          }
          return value;
      },
      get step() { return this.stepScale.invert(this.value); },
      
      /**
       * Scale with frame values (e.g. years) as domain and step number (e.g. 0-15) as range.
       * @returns D3 scale
       */
      // this scale uses binary search to find which subsection of scale to work on. Could be optimized
      // using knowledge frames are equidistant. Using e.g. time interval offset.
      // can't use 2 point linear scale as time is not completely linear (leap year/second etc)
      get stepScale() {
          // default domain data is after filtering, so empty frames are dropped, so steps doesn't include those
          const domainData = this.data.domainData; 
          const frameValues = [];
          domainData.each(group => frameValues.push(group.values().next().value[this.name]));
          // use (possible) dates in range so no need for separate utcScale on time concepts
          return d3.scaleLinear(d3.range(0, this.stepCount), frameValues); 
      },
      get stepCount() {
          return this.data.domainData.size
      },

      // PLAYBACK
      get speed() { return this.config.speed || defaults$4.speed },
      get loop() { return this.config.loop || defaults$4.loop },
      get playbackSteps() { return this.config.playbackSteps || defaults$4.playbackSteps },
      playing: false,
      togglePlaying() {
          this.playing ?
              this.stopPlaying() :
              this.startPlaying();
      },
      startPlaying: mobx.action('startPlaying', function startPlaying() {
          if (this.step >= this.stepCount - 1)
              this.setStep(0);

          this.setPlaying(true);
      }),
      stopPlaying: function() {
          this.setPlaying(false);
      },
      setPlaying: mobx.action('setPlaying', function setPlaying(playing) {
          this.playing = playing;
      }),
      setSpeed: mobx.action('setSpeed', function setSpeed(speed) {
          speed = Math.max(0, speed);
          this.config.speed = speed;
      }),
      setValue: mobx.action('setValue', function setValue(value) {
          const concept = this.data.conceptProps;
          let parsed = parseConfigValue(value, concept);
          if (parsed != null) {
              parsed = this.scale.clampToDomain(parsed);
          }
          this.config.value = configValue(parsed, concept);
      }),
      setStep: mobx.action('setStep', function setStep(step) {
          this.setValue(this.stepScale(step));
      }),
      setValueAndStop: mobx.action('setValueAndStop', function setValueAndStop(value) {
          this.stopPlaying();
          this.setValue(value);
      }),
      setStepAndStop: mobx.action('setStepAndStop', function setStepAndStop(step) {
          this.stopPlaying();
          this.setStep(step);
      }),
      snap: mobx.action('snap', function snap() {
          this.setStep(Math.round(this.step));
      }),
      nextStep: mobx.action('update to next frame value', function nextStep() {
          if (this.playing && this.marker.state === FULFILLED) {
              let nxt = this.step + this.playbackSteps;
              if (nxt < this.stepCount) {
                  this.setStep(nxt);
              } else if (this.step == this.stepCount - 1) {
                  // on last frame
                  if (this.loop) {
                      this.setStep(0);          
                  } else {
                      this.stopPlaying();
                  }
              } else {
                  // not yet on last frame, go there first
                  this.setStep(this.stepCount - 1); 
              }
          }
      }),

      // TRANSFORMS
      get transformationFns() {
          return {
              'frameMap': this.frameMap.bind(this),
              'currentFrame': this.currentFrame.bind(this)
          }
      },

      // FRAMEMAP TRANSFORM
      get interpolate() { return this.config.interpolate || defaults$4.interpolate },
      frameMap(data) {
          if (this.interpolate) 
              data = this.interpolateData(data);
          return data.groupBy(this.name, this.rowKeyDims);
      },
      interpolateData(df) {
          const concept = this.data.concept;
          const name = this.name;
          // can't use scale.domain as it is calculated after 
          // filterRequired, which needs data to be interpolated (and might have less frames)
          const domain = this.data.calcDomain(df, this.data.conceptProps);
          const newIndex = inclusiveRange(domain[0], domain[1], concept);

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
                      .reindex(newIndex) // reindex also orders (needed for interpolation)
                      .fillNull(fillFns) // fill nulls of marker space with custom fns
                      .interpolate()    // fill rest of nulls through interpolation
              })
              .flatten(df.key);
      },
      get rowKeyDims() {
          // remove frame concept from key if it's in there
          // e.g. <geo,year>,pop => frame over year => <year>-><geo>,year,pop 
          return relativeComplement([this.data.concept], this.data.space);
      },

      // CURRENTFRAME TRANSFORM
      currentFrame(data) {
          return data.has(this.frameKey) ? 
              data.get(this.frameKey)
              :
              this.getInterpolatedFrame(data, this.step);
          // else {
          //     console.warn("Frame value not found in frame map", this)
          //     return new Map();
          // }

      },
      get frameKey() {
          return createMarkerKey({ [this.name]: this.value });
      },
      getInterpolatedFrame(df, step) {
          if (!df.size) return;
          const keys = Array.from(df.keys());
          const [before, after] = this.stepsAround.map(step => df.get(keys[step]));
          return before.interpolateTowards(after, step % 1);
      },
      get stepsAround() {
          return [Math.floor(this.step), Math.ceil(this.step)];
      },
      get framesAround() {
          return this.stepsAround.map(this.stepScale);
      },

      /*
       * Compute the differential (stepwise differences) for the given field 
       * and return it as a new dataframe(group).
       * NOTE: this requires that the given df is interpolated.
       * USAGE: set a correct list of transformations on the __marker__
       * and then add/remove the string "differentiate" to the data of an 
       * encoding in that marker. For example:
       *   markers: {
       *      marker_destination: {
       *        encoding: {
       *           "x": {
       *             data: {
       *               concept: "displaced_population",
       *               transformations: ["differentiate"]
       *             }
       *           },
       *          ...
       *        },
       *        transformations: [
       *          "frame.frameMap",
       *          "x.differentiate",
       *          "filterRequired",
       *          "order.order",
       *          "trail.addTrails",
       *          "frame.currentFrame"
       *        ]
       * 
       */
      differentiate(df, xField) {
          let prevFrame;
          let result = DataFrameGroupMap([], df.key, df.descendantKeys);
          for (let [yKey, frame] of df) {
              const newFrame = frame.copy();
              for(let [key, row] of newFrame) {
                  const newRow = Object.assign({}, row);
                  const xValue = row[xField];
                  if (xValue !== undefined) {
                      newRow[xField] = prevFrame ? xValue - prevFrame.get(parseMarkerKey(key))[xField] : 0;
                  }
                  newFrame.set(newRow, key);
              }
              prevFrame = frame;
              result.set(yKey, newFrame);
          }
          return result;
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
                      this.nextStep();
                      this.playInterval = setInterval(this.nextStep.bind(this), speed);
                  }
              }, 
              { name: "frame playback timer" }
          );
      }
  };

  function frame(config) {
      applyDefaults(config, defaultConfig$3);
      return assign(encoding(config), functions$1);
  }

  const defaultConfig$4 = {
      data: {
          filter: {} // force own filter value so it doesn't fall back to marker filter like a normal encoding
      }
  };

  const selection = defaultDecorator({
      base: encoding,
      defaultConfig: defaultConfig$4
  });

  const directions$1 = {
      ascending: "ascending",
      descending: "descencding"
  };
  const defaults$5 = {
      direction: directions$1.ascending
  };

  const order$1 = defaultDecorator({
      base: encoding,
      functions: {
          get direction() {
              return this.data.config.direction || defaults$5.direction;
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

  const defaultConfig$5 = {
      data: { filter: { markers: {} } }
  };

  const defaults$6 = {
      starts: {},
      show: true,
      groupDim: null,
      starts: {}
  };

  function trail(config, parent) {

      applyDefaults(config, defaultConfig$5);

      const base = encoding(config, parent);

      return assign(base, {
          get show() { 
              return this.config.show || (typeof this.config.show === "undefined" && defaults$6.show) },
          get groupDim() {
              return this.config.groupDim || defaults$6.groupDim;
          },
          /**
           * For each trailed marker, get the min-max of the trail. 
           */
          get limits() {
              const markers = this.data.filter.markers;
              // should not use ordered datamap but the actual groupMap we trailed
              const groupMap = this.marker.getTransformedDataMap("order.order");

              const limits = {};
              for (let key of markers.keys()) {
                  limits[key] = this.groupMapExtent(groupMap, key);
              }
              return limits;
          },
          /**
           * Given a sorted and gapless `groupMap`, gives min and max groups in which `markerKey` is present
           * @param {*} groupMap groupMap sorted by key
           * @param {*} markerKey key whose groupKey-extent is to be found in groupMap
           * @returns {array} Array ([min,max]) of group keys in given `groupMap` for given `markerKey`
           */
          groupMapExtent(groupMap, markerKey) {
              let min, max, groupKey, group;
              for ([groupKey, group] of groupMap) {
                  if (group.hasByObjOrStr(null, markerKey)) {
                      if (min === undefined) {
                          min = group;
                      }
                      max = group;
                  } else if (min) {
                      break;
                  }
              }
              // should not rely on groupDim but use groupKey because group might itself be a groupMap
              return [min, max].map(group => group.getByObjOrStr(null, markerKey)[this.groupDim]);
          },
          /**
           * Set trail start of every bubble to `value` if value is lower than current trail start.
           * Should also include check for trail limit but action won't observe limits observable and thus not memoize it.
           */
          updateTrailStart: mobx.action('update trail start', function updateTrailStart(value) {
              for (let key in this.config.starts) {
                  const start = this.config.starts[key];
                  this.config.starts[key] = start < value ? start : value;
              }
          }),
          /**
           * Object of trail starts from config, clamped to trail lower limits
           */
          get starts() {
              const starts = {};
              for (let key in this.limits) {
                  const start = this.config.starts[key];
                  const minLimit = this.limits[key][0];
                  starts[key] = start > minLimit ? start : minLimit;
              }
              return starts;
          },
          setShow: mobx.action(function(show) {
              this.config.show = show;
              if (show === false) this.config.starts = defaults$6.starts;
          }),
          setTrail: mobx.action(function(d) {
              const key = this.getKey(d);
              this.config.starts[key] = d[this.groupDim]; // group key
              this.data.filter.set(d);
          }),
          deleteTrail: mobx.action(function(d) {
              const key = this.getKey(d);
              delete this.config.starts[key]; // group key
              this.data.filter.delete(d);
          }),
          getKey(d) {
              return isString$1(d) ? d : d[Symbol.for('key')];
          },
          get transformationFns() {
              return {
                  'addPreviousTrailHeads': this.addPreviousTrailHeads.bind(this),
                  'addTrails': this.addTrails.bind(this)
              }
          },
          addPreviousTrailHeads(groupMap) {
              const trailMarkers = this.data.filter.markers;
              if (trailMarkers.size == 0 || !this.show)
                  return groupMap;

              const newGroupMap = DataFrameGroupMap([], groupMap.key, groupMap.descendantKeys);
              const trailHeads = new Map();
              for (let [id, group] of groupMap) {
                  const historicalTrails = new Set();
                  for (let trailMarkerKey of trailMarkers.keys()) {
                      // current group doesn't have a head for this trail that has already passed
                      if (!group.hasByObjOrStr(null, trailMarkerKey)) {
                          if (trailHeads.has(trailMarkerKey)) {
                              historicalTrails.add(trailMarkerKey);
                          }
                      } else {
                          const trailMarker = group.getByObjOrStr(null, trailMarkerKey);
                          trailHeads.set(trailMarkerKey, trailMarker);
                      }
                  }

                  const newGroup = group.copy();
                  for (let trailMarkerKey of historicalTrails) {
                      const trailHead = trailHeads.get(trailMarkerKey);
                      newGroup.set(trailHead);
                  }
                  newGroupMap.set(id, newGroup);
              }
              return newGroupMap;
          },
          /**
           *  Per given marker, in whatever ordered group
           *  1. get markers from groups before its group (possibly starting at given group)
           *  2. add those markers to current group, with new key including original group (so no collission)
           * @param {*} groupMap 
           */
          addTrails(groupMap) {

              // can't use this.groupDim because circular dep this.marker.transformedDataMap
              const groupDim = groupMap.key[0]; // supports only 1 dimensional grouping
              const markers = this.data.filter.markers;

              if (markers.size == 0 || !this.show)
                  return groupMap;

              // create trails
              const trails = new Map();
              for (let key of markers.keys()) {
                  const trail = new Map();
                  trails.set(key, trail);
                  for (let [i, group] of groupMap) {
                      if (group.hasByObjOrStr(null,key))
                          trail.set(i, Object.assign({}, group.getByObjOrStr(null,key)));
                  }
              }

              // add trails to groups
              const prop = groupDim;
              const newGroupMap = DataFrameGroupMap([], groupMap.key, groupMap.descendantKeys);
              const trailKeyDims = [...groupMap.descendantKeys[0], prop];
              for (let [id, group] of groupMap) {
                  const newGroup = DataFrame([], group.key);
                  for (let [markerKey, markerData] of group) {
                      // insert trails before its head marker
                      if (trails.has(markerKey)) {
                          const trail = trails.get(markerKey);
                          const trailStart = this.starts[markerKey];
                          const trailEnd = markerData[prop];
                          // add trail markers in ascending order
                          for (let [keyStr, trailMarker] of trail) {
                              const idx = trailMarker[prop];
                              if (idx < trailStart) continue;
                              // idx > trailEnd includes main bubble in trail as well (as opposed to >=).
                              // This creates duplicate trail head markers in key frames but allows easy interpolation logic
                              // for interpolated frames. Trail head is source for two interpolated bubbles, current frame and (trail head-1).
                              // Another solution would be to allow multiple keys per datapoint (e.g. geo-swe-frame-2000 AND geo-swe)
                              // and make interpolation interpolate for both keys.
                              if (idx > trailEnd) break;
                              const newKey = createMarkerKey(trailMarker, trailKeyDims);
                              const newData = Object.assign(trailMarker, {
                                  [Symbol.for('key')]: newKey,
                                  [Symbol.for('trailHeadKey')]: markerKey
                              });
                              newGroup.set(newData, newKey);
                          }
                      }
                      // (head) marker
                      newGroup.set(markerData, markerKey);
                  }
                  newGroupMap.set(id, newGroup);
              }
              return newGroupMap;
          }
      });
  }

  const encodingStore = createStore(encoding, {
      frame,
      selection,
      order: order$1,
      trail
  });

  const defaultConfig$6 = {
      data: {
          space: undefined,
          filter: {}
      },
  };

  const defaults$7 = {
      encoding: {},
      requiredEncodings: [],
      transformations: [
          "frame.frameMap",
          "filterRequired", // after framemap so doesn't remove interpolatable rows
          "trail.addPreviousTrailHeads", // before ordering so trailheads get ordered
          "order.order", 
          "trail.addTrails", // after ordering so trails stay together
          "frame.currentFrame" // final to make it quick
      ]
  };

  function marker(config) {

      let encodingCache = {};

      let functions = {
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
          eventListeners: new Map(),
          getEventListenersMapFor(prop) {
              if (!this.eventListeners.has(prop))
                  this.eventListeners.set(prop, new Map());
              return this.eventListeners.get(prop);
          },
          get data() {
              const config = this.config.data || defaults$7.data;
              return dataConfigStore.get(config, this);
          },
          get requiredEncodings() { return this.config.requiredEncodings || defaults$7.requiredEncodings },
          // encodings are saved by property in non-observable encodingCache
          // this prevents that all encoding are recreated every time an encoding is added/deleted in config
          get encodingCache() { return encodingCache },
          updateEncodingCache(encodingConfig) {
              this.fillEncodingCache(encodingConfig);
              this.purgeStaleEncodingCache(encodingConfig);
              return this.encodingCache;
          },
          fillEncodingCache(encodingConfig) {
              for (const prop in encodingConfig) {
                  if (!(prop in this.encodingCache)) {
                      this.encodingCache[prop] = encodingStore.get(encodingConfig[prop], this);
                  }
              }
          },
          purgeStaleEncodingCache(encodingConfig) {
              for (const prop in this.encodingCache) {
                  if (!(prop in encodingConfig)) {
                      delete this.encodingCache[prop];
                  }
              }
          },
          get encoding() {
              const validEncoding = config => config() && Object.keys(config()).length > 0;
              const configGetters = [
                  () => this.config.encoding, 
                  () => defaults$7.encoding, 
                  () => this.data.source.defaultEncoding
              ];
              const config = configGetters.find(validEncoding);
              if (!config)
                  console.warn("No encoding found and marker data source has no default encodings");
                  
              return this.updateEncodingCache(config());
          },
          // TODO: encodings should know the property they encode to themselves; not sure how to pass generically yet 
          getEncodingName(encoding) {
              for (let [name, enc] of Object.entries(this.encoding)) {
                  if (enc == encoding) return name;
              }
          },
          get state() {
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
          differentiate(xField, data) {
              const frame = this.encoding.get("frame");
              return frame && this.encoding.get(xField) ? frame.differentiate(data, xField) : data
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
                  if (enc.config && enc.config.data && enc.config.data.transformations instanceof Array) {
                      for (let tName of enc.config.data.transformations) {
                          const fn = this[tName];
                          if (fn)
                              transformations[name + '.' + tName] = fn.bind(this, name);
                      }
                  }
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
              const transformations = this.config.transformations || defaults$7.transformations;
              const transformationFns = this.transformationFns;
              return transformations
                  .filter(tStr => tStr in transformationFns)
                  .map(tStr => ({
                          fn: this.transformationFns[tStr],
                          name: tStr
                  }));
          },
          get transformInputs() {
              let stepInputGetter = () => this.dataMapCache;
              let inputs = {};

              this.transformations.forEach(({name, fn}) => {
                  Object.defineProperty(inputs, name, {
                      get: stepInputGetter
                  });
                  const [encoding, resultProp] = name.split('.');
                  stepInputGetter = () => this.encoding.get(encoding)[resultProp];
              });
              return mobx.observable(inputs);
          },
          /**
           * transformedDataMaps is an ES6 Map
           *  whose keys are transformation strings or "final" and
           *  whose values are DataFrames wrapped in a boxed mobx computed. 
           *      The DataFrame is a result of the transformation function applied to the previous DataFrame.  
           */
          // currently all transformation steps are cached in computed values. Computeds are great to prevent recalculations
          // of previous steps when config of one step changes. However, it uses memory. We might want this more configurable.
          get transformedDataMaps() {
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
          },
          getDataMapByFrameValue(value) {
              const frame = this.encoding.get("frame");
              if (!frame) return this.dataMap;

              const frameKey = createMarkerKey({ [frame.name]: value }, [frame.name]);
              const data = this.getTransformedDataMap('filterRequired');
              return data.has(frameKey) ? 
                  data.get(frameKey)
                  :
                  frame.getInterpolatedFrame(data, value);
          }
      };

      applyDefaults(config, defaultConfig$6);
      return assign({}, functions, configurable, { config });
  }

  const defaultConfig$7 = {
      requiredEncodings: ["x", "y", "size"],
      encoding: {
          size: { scale: { modelType: "size" } }
      }
  };

  function bubble(config) {
      const base = marker(config);

      applyDefaults(config, defaultConfig$7);

      return assign(base, {
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

  bubble.decorate = marker.decorate;

  const markerStore = createStore(marker, { bubble });
  markerStore.getMarkerForEncoding = function(enc) {
      return this.getAll().find(marker => {
          return [...marker.encoding.values()].some(encoding => enc === encoding);
      }) || null;
  };

  function createConfig(configObject, externalRoots = {}) {
      const observableCfg = mobx.observable(configObject);
      Object.assign(externalRoots, { self: observableCfg });
      const dereffedCfg = resolveReferences(observableCfg, externalRoots);
      return dereffedCfg;
  }

  createConfig.diff = function diff(...configs) {
      const result = {};
      for (prop in configs) {
          
      }
      return result;
  }; 

  function resolveReferences(node, roots) {
      // resolve if this node is a reference node
      let resolved = resolveRef(node, roots);

      // return if leaf node
      if (typeof resolved !== "object" || !mobx.isObservableObject(resolved)) 
          return resolved;

      let clone = {};
      // recursively clone other properties in this node as computed props
      for (let key in node) {
          if (key === "ref") continue;
          copyPropertyAsComputed(node, key, clone);
      }
      if (node !== resolved) {
          for (let key in resolved) {
              copyPropertyAsComputed(resolved, key, clone);
          }
      }

      return clone;

      function copyPropertyAsComputed(obj, key, target) {
          Object.defineProperty(target, key, {
              enumerable: true,
              configurable: true,
              get: function() {
                  return resolveReferences(obj[key], roots);
              },
              set: function(value) {
                  obj[key] = value;
              }
          });
      }
  }

  /**
   * 
   * @param {*} possibleRef 
   * @returns config Config object as described in reference config
   */
  function resolveRef(possibleRef, roots) {
      // no ref
      if (!possibleRef || typeof possibleRef.ref === "undefined")
          return possibleRef

      // handle config shorthand
      let ref = isString$1(possibleRef.ref) ? { root: "self", path: possibleRef.ref } : possibleRef.ref;

      // resolve root to actual root object
      let root = roots[ref.root];

      // invalid ref
      if (!root) {
          console.warn("Invalid reference, root object neither found in reference nor passed to reference resolver.", { ref, root });
      }

      const resolvedObj = resolveTreeRef(ref, root);
      return transformModel(resolvedObj, ref.transform);
  }

  function resolveTreeRef({ path }, root) {
      const refParts = path.split('.');
      let node = root;
      for (let child of refParts) {
          if (typeof node.get == "function")
              node = node.get(child);
          else
              node = node[child];
          if (typeof node == "undefined") {
              console.warn("Couldn't resolve reference path " + path, { root });
              return null;
          }
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
          default:
              return model;
      }
  }

  const stores = {
      markers: markerStore,
      dataSources: dataSourceStore,
      encodings: encodingStore
  };

  const vizabi = function(plainCfg) {
      const config = createConfig(plainCfg, { model: stores });
      const models = {};
      
      for (const storeName in stores) {
          models[storeName] = stores[storeName].createMany(config[storeName] || {});
      }
      
      return models;
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
      cfg = createConfig(cfg);
      return dataSourceStore.set(cfg, id);
  }; 
  vizabi.marker = (cfg, id) => {
      cfg = createConfig(cfg);
      return markerStore.set(cfg, id);
  };
  vizabi.encoding = (cfg, id) => {
      cfg = createConfig(cfg);
      return encodingStore.set(cfg, id);
  };

  return vizabi;

})));
//# sourceMappingURL=Vizabi.js.map
