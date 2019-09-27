(function webpackUniversalModuleDefinition(root, factory) {
	if(typeof exports === 'object' && typeof module === 'object')
		module.exports = factory();
	else if(typeof define === 'function' && define.amd)
		define([], factory);
	else if(typeof exports === 'object')
		exports["Dataframe"] = factory();
	else
		root["Dataframe"] = factory();
})(window, function() {
return /******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = "./src/dataframe/dataFrame.js");
/******/ })
/************************************************************************/
/******/ ({

/***/ "./src/dataframe/dataFrame.js":
/*!************************************!*\
  !*** ./src/dataframe/dataFrame.js ***!
  \************************************/
/*! exports provided: DataFrame */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, \"DataFrame\", function() { return DataFrame; });\n/* harmony import */ var _transforms_order__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./transforms/order */ \"./src/dataframe/transforms/order.js\");\n/* harmony import */ var _transforms_fulljoin__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./transforms/fulljoin */ \"./src/dataframe/transforms/fulljoin.js\");\n/* harmony import */ var _storage_map__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./storage/map */ \"./src/dataframe/storage/map.js\");\n/* harmony import */ var _storage_lookups__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./storage/lookups */ \"./src/dataframe/storage/lookups.js\");\n/* harmony import */ var _transforms_copycolumn__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./transforms/copycolumn */ \"./src/dataframe/transforms/copycolumn.js\");\n/* harmony import */ var _transforms_leftjoin__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./transforms/leftjoin */ \"./src/dataframe/transforms/leftjoin.js\");\n/* harmony import */ var _transforms_filter__WEBPACK_IMPORTED_MODULE_6__ = __webpack_require__(/*! ./transforms/filter */ \"./src/dataframe/transforms/filter.js\");\n/* harmony import */ var _transforms_project__WEBPACK_IMPORTED_MODULE_7__ = __webpack_require__(/*! ./transforms/project */ \"./src/dataframe/transforms/project.js\");\n/* harmony import */ var _transforms_addColumn__WEBPACK_IMPORTED_MODULE_8__ = __webpack_require__(/*! ./transforms/addColumn */ \"./src/dataframe/transforms/addColumn.js\");\n/* harmony import */ var _transforms_group__WEBPACK_IMPORTED_MODULE_9__ = __webpack_require__(/*! ./transforms/group */ \"./src/dataframe/transforms/group.js\");\n/* harmony import */ var _transforms_interpolate__WEBPACK_IMPORTED_MODULE_10__ = __webpack_require__(/*! ./transforms/interpolate */ \"./src/dataframe/transforms/interpolate.js\");\n/* harmony import */ var _transforms_reindex__WEBPACK_IMPORTED_MODULE_11__ = __webpack_require__(/*! ./transforms/reindex */ \"./src/dataframe/transforms/reindex.js\");\n/* harmony import */ var _transforms_fillnull__WEBPACK_IMPORTED_MODULE_12__ = __webpack_require__(/*! ./transforms/fillnull */ \"./src/dataframe/transforms/fillnull.js\");\n/* harmony import */ var _info_extent__WEBPACK_IMPORTED_MODULE_13__ = __webpack_require__(/*! ./info/extent */ \"./src/dataframe/info/extent.js\");\n/* harmony import */ var _info_unique__WEBPACK_IMPORTED_MODULE_14__ = __webpack_require__(/*! ./info/unique */ \"./src/dataframe/info/unique.js\");\n/* harmony import */ var _transforms_copy__WEBPACK_IMPORTED_MODULE_15__ = __webpack_require__(/*! ./transforms/copy */ \"./src/dataframe/transforms/copy.js\");\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n//df.get([\"swe\",\"2015\"]).population\nconst fromLookups = (concepts, key) => constructDataFrame(Object(_storage_lookups__WEBPACK_IMPORTED_MODULE_3__[\"LookupStorage\"])(concepts, key));\nconst fromArray = (data = [], key = data.key || []) => constructDataFrame(Object(_storage_map__WEBPACK_IMPORTED_MODULE_2__[\"MapStorage\"])(data, key));\n\nconst DataFrame = fromArray;\nDataFrame.fromLookups = fromLookups;\nDataFrame.fromArray = fromArray;\n\nfunction constructDataFrame(storage) {\n    // https://medium.com/javascript-scene/the-hidden-treasures-of-object-composition-60cd89480381\n    // compose storage and DF methods by concatenation \n    // concatenation instead of aggregation/delegation as there is no overlap in keys and \n    // we want the full storage API to be available on the DataFrame\n    const df = Object.assign(storage,\n        {        \n            // transforms\n            order: (direction) => Object(_transforms_order__WEBPACK_IMPORTED_MODULE_0__[\"order\"])(df, direction), \n            leftJoin: (rightJoinParams) => Object(_transforms_leftjoin__WEBPACK_IMPORTED_MODULE_5__[\"leftJoin\"])({ dataFrame: df }, rightJoinParams),\n            fullJoin: (joinParams, key) => Object(_transforms_fulljoin__WEBPACK_IMPORTED_MODULE_1__[\"fullJoin\"])([{ dataFrame: df }, ...joinParams], key),\n            copyColumn: (src, dest) => Object(_transforms_copycolumn__WEBPACK_IMPORTED_MODULE_4__[\"copyColumn\"])(df, src, dest),\n            filter: (filterObj) => Object(_transforms_filter__WEBPACK_IMPORTED_MODULE_6__[\"filter\"])(df, filterObj),\n            project: (projection) => Object(_transforms_project__WEBPACK_IMPORTED_MODULE_7__[\"project\"])(df, projection),\n            addColumn: (name, value) => Object(_transforms_addColumn__WEBPACK_IMPORTED_MODULE_8__[\"addColumn\"])(df, name, value),\n            groupBy: (groupKey, memberKey) => Object(_transforms_group__WEBPACK_IMPORTED_MODULE_9__[\"groupBy\"])(df, groupKey, memberKey),\n            interpolate: () => Object(_transforms_interpolate__WEBPACK_IMPORTED_MODULE_10__[\"interpolate\"])(df),\n            reindex: (stepFn) => Object(_transforms_reindex__WEBPACK_IMPORTED_MODULE_11__[\"reindex\"])(df, stepFn),\n            fillNull: (fillValues) => Object(_transforms_fillnull__WEBPACK_IMPORTED_MODULE_12__[\"fillNull\"])(df, fillValues),\n            copy: () => Object(_transforms_copy__WEBPACK_IMPORTED_MODULE_15__[\"copy\"])(df),\n    \n            // info\n            extent: (concept) => Object(_info_extent__WEBPACK_IMPORTED_MODULE_13__[\"extent\"])(df, concept),\n            unique: (concept) => Object(_info_unique__WEBPACK_IMPORTED_MODULE_14__[\"unique\"])(df, concept),\n        \n            // export\n            toJSON: () => [...df.values()]\n        },\n        {\n            filterGroups: filterFn => {\n                return df.copy();\n            },\n            setRow: row => df.set(row)\n        }\n    );\n\n    return df;\n}\n\n//# sourceURL=webpack://%5Bname%5D/./src/dataframe/dataFrame.js?");

/***/ }),

/***/ "./src/dataframe/dataFrameGroup.js":
/*!*****************************************!*\
  !*** ./src/dataframe/dataFrameGroup.js ***!
  \*****************************************/
/*! exports provided: DataFrameGroupMap */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, \"DataFrameGroupMap\", function() { return DataFrameGroupMap; });\n/* harmony import */ var _dataFrame__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./dataFrame */ \"./src/dataframe/dataFrame.js\");\n/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./utils */ \"./src/dataframe/utils.js\");\n/* harmony import */ var _transforms_interpolate__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./transforms/interpolate */ \"./src/dataframe/transforms/interpolate.js\");\n/* harmony import */ var _transforms_order__WEBPACK_IMPORTED_MODULE_3__ = __webpack_require__(/*! ./transforms/order */ \"./src/dataframe/transforms/order.js\");\n/* harmony import */ var _transforms_reindex__WEBPACK_IMPORTED_MODULE_4__ = __webpack_require__(/*! ./transforms/reindex */ \"./src/dataframe/transforms/reindex.js\");\n/* harmony import */ var _transforms_filter__WEBPACK_IMPORTED_MODULE_5__ = __webpack_require__(/*! ./transforms/filter */ \"./src/dataframe/transforms/filter.js\");\n\n\n\n\n\n\n\n/**\n * \n * @param {*} df DataFrame from which to create groups\n * @param {*} key key by which is grouped\n * @param {*} descKeys keys of groups and their descendants\n */\nfunction DataFrameGroupMap(df, key, descKeys = []) {\n\n    if (!Array.isArray(descKeys)) descKeys = [[descKeys]]; // desc keys is single string (e.g. 'year')\n    if (!Array.isArray(descKeys[0])) descKeys = [descKeys]; // desc keys is one key (e.g. ['year'])\n    if (!Array.isArray(key)) key = [key]; // key is single string (e.g. 'year')\n    if (!Object(_utils__WEBPACK_IMPORTED_MODULE_1__[\"isDataFrame\"])(df)) df = Object(_dataFrame__WEBPACK_IMPORTED_MODULE_0__[\"DataFrame\"])(df);\n    if (descKeys.length === 0) descKeys = [df.key];  // descKeys is empty\n    \n    const groupMap = createGroupMap(key, descKeys, df)\n\n    for (let row of df.values()) {\n        groupMap.setRow(row);\n    }\n\n    return groupMap; \n}\n\nfunction createGroupMap(key, descendantKeys) {\n    const groupMap = new Map();\n    groupMap.key = key;\n    groupMap.keyFn = Object(_utils__WEBPACK_IMPORTED_MODULE_1__[\"createKeyFn\"])(key);\n    groupMap.descendantKeys = descendantKeys;\n    groupMap.groupType = () => groupMap.descendantKeys.length === 1 ? 'DataFrame' : 'GroupMap';\n    groupMap.each = (fn) => each(groupMap, fn);\n    groupMap.map = (fn) => map(groupMap, fn);\n    // groupMap.mapCall = (fn) => mapCall(groupMap, fn); // not exposing mapcall\n    groupMap.interpolate = mapCall(groupMap, \"interpolate\");\n    groupMap.filter = mapCall(groupMap, \"filter\");\n    groupMap.order = mapCall(groupMap, \"order\");\n    groupMap.reindex = mapCall(groupMap, \"reindex\");\n    groupMap.flatten = (key) => flatten(groupMap, key);\n    groupMap.groupBy = (key) => {\n        for (group of groupMap.values()) {\n            const newGroup = group.groupBy(key);\n\n            // groups change from DataFrame to GroupMap\n            if (groupMap.groupType() === 'DataFrame')\n                groupMap.set(key, newGroup);\n        }\n        groupMap.descendantKeys.push(key);\n        return groupMap;\n    }\n    groupMap.createChild = (keyStr) => createChild(groupMap, keyStr);\n    groupMap.toJSON = () => mapToObject(groupMap);\n    groupMap.rows = function* () {\n        let group, row; \n        for (group of groupMap.values()) {\n            for (row of group.rows()) // get rows recursively\n                yield row;\n        }\n    }\n    groupMap.filterGroups = (filterFn) => {\n        let result = DataFrameGroupMap([], groupMap.key, groupMap.descendantKeys);\n        for (let [key, group] of groupMap) {\n            const newGroup = group.filterGroups(filterFn);\n            if (filterFn(newGroup)) \n                result.set(key, newGroup);\n        }\n        return result;\n    }\n    groupMap.setRow = (row) => {\n        getOrCreateGroup(groupMap, row)\n            .setRow(row);\n    }\n    return groupMap;\n}\n\nfunction each(grouping, fn) {\n    for (let [key, df] of grouping) {\n        fn(df, Object(_utils__WEBPACK_IMPORTED_MODULE_1__[\"parseMarkerKey\"])(key));\n    }\n    return grouping;\n}\n\nfunction map(grouping, fn) {\n    for (let [key, df] of grouping) {\n        grouping.set(key, fn(df, Object(_utils__WEBPACK_IMPORTED_MODULE_1__[\"parseMarkerKey\"])(key)));\n    }\n    return grouping;\n}\n\nfunction mapCall(groupMap, fnName) {\n    return function() {\n        let result = DataFrameGroupMap([], groupMap.key, groupMap.descendantKeys);\n        for (let [key, group] of groupMap) {\n            result.set(key, group[fnName](...arguments));\n        }\n        return result;\n    }\n}\n\n/**\n * \n * @param {*} group the group to find member in\n * @param {*} row data row to find member for\n */\nfunction getOrCreateGroup(groupMap, row) {\n    let group;\n    const keyStr = groupMap.keyFn(row);\n    if (groupMap.has(keyStr)) {\n        group = groupMap.get(keyStr);\n    } else {\n        group = groupMap.createChild(keyStr);\n    }\n    return group;\n}\n\nfunction createChild(groupMap, keyStr) {\n    // DataFrames have no children of their own (= leafs)\n    const child = groupMap.descendantKeys.length === 1\n        ? Object(_dataFrame__WEBPACK_IMPORTED_MODULE_0__[\"DataFrame\"])([], groupMap.descendantKeys[0])\n        : DataFrameGroupMap([], groupMap.descendantKeys[0], groupMap.descendantKeys.slice(1));\n    \n    groupMap.set(keyStr, child);\n    return child;\n}\n\nfunction flatten(group, key = []) {\n    function* entries() {\n        for (let df of group.values()) {\n            for (let row of df.values()) {\n                yield row;\n            }\n        }\n    }\n    return Object(_dataFrame__WEBPACK_IMPORTED_MODULE_0__[\"DataFrame\"])(entries(), key);\n}\n\n//# sourceURL=webpack://%5Bname%5D/./src/dataframe/dataFrameGroup.js?");

/***/ }),

/***/ "./src/dataframe/info/extent.js":
/*!**************************************!*\
  !*** ./src/dataframe/info/extent.js ***!
  \**************************************/
/*! exports provided: extent */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, \"extent\", function() { return extent; });\n/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../utils */ \"./src/dataframe/utils.js\");\n\n\n// in the style of d3.extent\nfunction extent(iter, concept) {\n    iter = Object(_utils__WEBPACK_IMPORTED_MODULE_0__[\"getIter\"])(iter);\n    let min, max, value, row;\n    for (row of iter) {\n        if ((value = row[concept]) != null && value >= value) {\n            if (min === undefined) {\n                // find first comparable values\n                min = max = value;\n            } else {\n                // compare remaining values \n                if (min > value) min = value;\n                if (max < value) max = value;\n            }\n        }\n    }\n    return [min, max];\n}\n\n\n//# sourceURL=webpack://%5Bname%5D/./src/dataframe/info/extent.js?");

/***/ }),

/***/ "./src/dataframe/info/unique.js":
/*!**************************************!*\
  !*** ./src/dataframe/info/unique.js ***!
  \**************************************/
/*! exports provided: unique */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, \"unique\", function() { return unique; });\n/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../utils */ \"./src/dataframe/utils.js\");\n\n\nfunction unique(iter, concept) {\n    iter = Object(_utils__WEBPACK_IMPORTED_MODULE_0__[\"getIter\"])(iter);\n    \n    const unique = new Set()\n    for (let row of iter) \n        unique.add(row[concept]); \n\n    return [...unique];\n}\n\n\n//# sourceURL=webpack://%5Bname%5D/./src/dataframe/info/unique.js?");

/***/ }),

/***/ "./src/dataframe/storage/lookups.js":
/*!******************************************!*\
  !*** ./src/dataframe/storage/lookups.js ***!
  \******************************************/
/*! exports provided: LookupStorage */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, \"LookupStorage\", function() { return LookupStorage; });\n/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../utils */ \"./src/dataframe/utils.js\");\n\n\n/**\n * Virtual data frame storage based on lookups. A row is constructed on request from lookups for each dimension of requested key.\n * @param {*} concepts Map of concepts. Each concept is a map of dimensions. Each dimension is a map of values on that dimension. E.g. name=>geo=>swe=>Sweden\n */\nfunction LookupStorage(concepts, keyArr) {\n    const storage = {};\n    storage.key = keyArr = Object(_utils__WEBPACK_IMPORTED_MODULE_0__[\"normalizeKey\"])(keyArr);\n    storage.fields = new Set([...keyArr, ...concepts.keys()]);\n    storage.data = concepts;\n    storage.has = (keyObj) => {\n        // true if there is at least one concept which has a lookup for every dimension in key\n        // i.e. a row can be returned for this key\n        return true; //[...concepts.values()].some(lookups => keyArr.every(dim => dim in keyObj && lookups.has(dim)));\n    }\n    storage.get = (keyObj) => {\n        const row = {};\n        concepts.forEach((lookups, concept) => {\n            const entityProps = {};\n            keyArr.forEach(dim => {\n                if (lookups.has(dim))\n                    entityProps[dim] = lookups.get(dim).get(keyObj[dim]);\n                else\n                    entityProps[dim] = keyObj[dim];\n            });\n            row[concept] = entityProps;\n        });\n        return row;\n    }\n    storage.hasByObjOrStr = (keyObj, keyStr) => storage.has(keyObj);\n    storage.getByObjOrStr = (keyObj, keyStr) => storage.get(keyObj);\n    storage.set = (keyObj, value) => { \n        console.warn(\"Invalid operation. Generated dataframe does not support .set().\")\n    }\n    storage.values = () => { console.warn(\"Generated dataframe .values() not implemented yet\")};\n    storage.delete = () => { console.warn(\"Invalid operation. Generated dataframe does not support .delete()\")};\n    storage[Symbol.iterator] = function* generate() {\n        console.warn(\"Invalid operation. Generated dataframe iterator not yet implemented.\");\n    } \n    return storage;\n}\n\n//# sourceURL=webpack://%5Bname%5D/./src/dataframe/storage/lookups.js?");

/***/ }),

/***/ "./src/dataframe/storage/map.js":
/*!**************************************!*\
  !*** ./src/dataframe/storage/map.js ***!
  \**************************************/
/*! exports provided: MapStorage */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, \"MapStorage\", function() { return MapStorage; });\n/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../utils */ \"./src/dataframe/utils.js\");\n\n\nfunction MapStorage(data = [], keyArr = data.key || []) {\n    \n    const storage = createEmptyMap();\n    storage.key = keyArr;\n    storage.batchSet(data);\n\n    return storage;\n}\n\nfunction createEmptyMap() {\n    const storage = new Map();\n    let key = [], isRangeKey;\n\n    // local references to functions which will be decorated\n    const has = storage.has.bind(storage);\n    const get = storage.get.bind(storage);\n    const set = storage.set.bind(storage);\n\n    storage.fields = new Set();\n    storage.keyFn = Object(_utils__WEBPACK_IMPORTED_MODULE_0__[\"rangeIndex\"])(0);\n    storage.setKey = newKey => {\n        key = Object(_utils__WEBPACK_IMPORTED_MODULE_0__[\"normalizeKey\"])(newKey); \n        isRangeKey = key.length === 0; \n        storage.keyFn = isRangeKey ? Object(_utils__WEBPACK_IMPORTED_MODULE_0__[\"rangeIndex\"])(0) : Object(_utils__WEBPACK_IMPORTED_MODULE_0__[\"createKeyFn\"])(storage.key);\n        storage.updateIndexes(storage);\n    }\n    Object.defineProperty(storage, 'key', { \n        set: storage.setKey,\n        get: () => key\n    });\n    storage.has = keyObj => isRangeKey ? false     : has(storage.keyFn(keyObj));\n    storage.get = keyObj => isRangeKey ? undefined : get(storage.keyFn(keyObj));\n    storage.set = (row, keyStr) => {\n        // passing keyStr is optimization to circumvent keyStr generation (TODO: check performance impact)\n        // if keyStr set, we assume it's correct. Only use when you know keyStr fits with current key dims\n        if (keyStr === undefined || isRangeKey)\n            keyStr = storage.keyFn(row, key);\n        checkFields(storage.fields, row);\n        row[Symbol.for('key')] = keyStr;\n        set(keyStr, row);\n    }\n    storage.hasByObjOrStr = (keyObj, keyStr) => has(keyStr);\n    storage.getByObjOrStr = (keyObj, keyStr) => get(keyStr);\n    storage.batchSet = rowIter => batchSet(storage, rowIter);\n    storage.rows = storage.values;\n    storage.updateIndexes = () => updateIndexes(storage);\n    return storage;\n}\n\nfunction checkFields(fields, row) {\n    for (let field in row) {\n        if (!fields.has(field)) {\n            fields.add(field);\n        }\n    }\n}\n\nfunction batchSet(storage, rowIter) {\n    const duplicates = [];\n\n    rowIter = Object(_utils__WEBPACK_IMPORTED_MODULE_0__[\"getIter\"])(rowIter);\n\n    for (let row of rowIter) {\n        if (storage.has(row))\n            duplicates.push({ keyStr: storage.keyFn(row), orig: storage.get(row), new: row})\n        storage.set(row);\n    }\n\n    if (duplicates.length > 0)\n        console.warn('Found duplicates for given key when constructing dataframe.', { key: storage.key, duplicates });\n}\n\nfunction updateIndexes(storage) {\n    for (let [key, row] of storage) {\n        storage.delete(key);\n        // set won't overwrite any not-yet-deleted keys \n        // because key dims are either different \n        // or if they're identical, we just removed the key it would overwrite\n        storage.set(row); \n    }\n}\n\n//# sourceURL=webpack://%5Bname%5D/./src/dataframe/storage/map.js?");

/***/ }),

/***/ "./src/dataframe/transforms/addColumn.js":
/*!***********************************************!*\
  !*** ./src/dataframe/transforms/addColumn.js ***!
  \***********************************************/
/*! exports provided: addColumn */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, \"addColumn\", function() { return addColumn; });\n/**\n * Adds column to df, in place\n * @param {DataFrame} df \n * @param {string} name \n * @param {value|function} value \n */\nfunction addColumn(df, name, value) {\n    if (typeof value == \"function\") {\n        for (let row of df.values()) {\n            row[name] = value(row);\n        }\n    }\n    else {    \n        for (let row of df.values()) {\n            row[name] = value;\n        }\n    }\n    return df;\n}\n\n//# sourceURL=webpack://%5Bname%5D/./src/dataframe/transforms/addColumn.js?");

/***/ }),

/***/ "./src/dataframe/transforms/copy.js":
/*!******************************************!*\
  !*** ./src/dataframe/transforms/copy.js ***!
  \******************************************/
/*! exports provided: copy */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, \"copy\", function() { return copy; });\n/* harmony import */ var _dataFrame__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../dataFrame */ \"./src/dataframe/dataFrame.js\");\n\n\nconst copy = df => Object(_dataFrame__WEBPACK_IMPORTED_MODULE_0__[\"DataFrame\"])(df);\n\n//# sourceURL=webpack://%5Bname%5D/./src/dataframe/transforms/copy.js?");

/***/ }),

/***/ "./src/dataframe/transforms/copycolumn.js":
/*!************************************************!*\
  !*** ./src/dataframe/transforms/copycolumn.js ***!
  \************************************************/
/*! exports provided: copyColumn */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, \"copyColumn\", function() { return copyColumn; });\nfunction copyColumn(df, srcCol, newCol) {\n    for (let row of df.values()) {\n        row[newCol] = row[srcCol];\n    }\n    return df;\n}\n\n//# sourceURL=webpack://%5Bname%5D/./src/dataframe/transforms/copycolumn.js?");

/***/ }),

/***/ "./src/dataframe/transforms/fillnull.js":
/*!**********************************************!*\
  !*** ./src/dataframe/transforms/fillnull.js ***!
  \**********************************************/
/*! exports provided: fillNull */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, \"fillNull\", function() { return fillNull; });\n/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../utils */ \"./src/dataframe/utils.js\");\n\n\nfunction fillNull(df, fillValues) {\n    let concept, row;\n    // per concept fill\n    if (Object(_utils__WEBPACK_IMPORTED_MODULE_0__[\"isNonNullObject\"])(fillValues)) {\n        for (concept in fillValues) {\n            const fillValue = fillValues[concept];\n            // per concept function fill\n            if (typeof fillValue == \"function\") {\n                for (row of df.values()) {\n                    if (row[concept] === null)\n                        row[concept] = fillValue(row);\n                }\n            }\n            // per concept constant fill\n            else {\n                for (row of df.values()) {\n                    if (row[concept] === null)\n                        row[concept] = fillValue;\n                }\n            }\n        }\n    }\n    // constant fill\n    else {\n        for (row of df.values()) {\n            for (concept in row) {\n                if (row[concept] === null)\n                    row[concept] = fillValues;\n            }\n        }\n    }\n    return df;\n}\n\n//# sourceURL=webpack://%5Bname%5D/./src/dataframe/transforms/fillnull.js?");

/***/ }),

/***/ "./src/dataframe/transforms/filter.js":
/*!********************************************!*\
  !*** ./src/dataframe/transforms/filter.js ***!
  \********************************************/
/*! exports provided: filter, createFilterFn, applyFilterRow */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, \"filter\", function() { return filter; });\n/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, \"createFilterFn\", function() { return createFilterFn; });\n/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, \"applyFilterRow\", function() { return applyFilterRow; });\n/* harmony import */ var _dataFrame__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../dataFrame */ \"./src/dataframe/dataFrame.js\");\n\n\n/**\n * Filters dataframe based on either filter function or DDFQL filter specification\n * @param {DataFrame} df \n * @param {Function|FilterSpec} filter \n */\nfunction filter(df, filter) {\n\n    if (!validFilterArg(filter))\n        return df;\n\n    const filterFn = (typeof filter == \"function\") ? \n        filter : createFilterFn(filter);    \n\n    const result = Object(_dataFrame__WEBPACK_IMPORTED_MODULE_0__[\"DataFrame\"])([], df.key);\n    for(let [key, row] of df) {\n        if (filterFn(row))\n            result.set(row, key);\n    }\n\n    return result;\n}\n\nfunction validFilterArg(filter) {\n    return filter && (typeof filter === \"function\" || Object.keys(filter).length > 0)\n}\n\n/**\n * Partially apply applyFilterRow, giving only the filter spec\n * @param {Object} filterSpec Filter specification according to DDFQL WHERE spec\n * @returns {Function} Filter function, which takes an object and returns a boolean representing if the object satifies the filterSpec\n */\nfunction createFilterFn(filterSpec) {\n    return (row) => applyFilterRow(row, filterSpec);\n}\n\nfunction applyFilterRow(row, filter) {\n    // implicit $and in filter object handled by .every()\n    return Object.keys(filter).every(filterKey => {\n        let operator;\n        if (operator = operators.get(filterKey)) {\n            // { $eq: \"europe\" } / { $lte: 5 } / { $and: [{...}, ...] }\n            return operator(row, filter[filterKey]);\n        } else if(typeof filter[filterKey] != \"object\") { // assuming values are primitives not Number/Boolean/String objects\n            // { <field>: <value> } is shorthand for { <field>: { $eq: <value> }} \n            return operators.get(\"$eq\")(row[filterKey], filter[filterKey]);\n        } else {\n            // filterSpec[filterKey] is an object and will thus contain a comparison operator\n            // { <field>: { $<operator>: <value> }}\n            // no deep objects (like in Mongo) supported:\n            // { <field>: { <subfield>: { ... } } }\n            return applyFilterRow(row[filterKey], filter[filterKey]);\n        }\n    });\n}\n\nconst operators = new Map([\n    /* logical operators */\n    [\"$and\", (row, predicates) => predicates.every(p => applyFilterRow(row,p))],\n    [\"$or\",  (row, predicates) => predicates.some(p => applyFilterRow(row,p))],\n    [\"$not\", (row, predicate) => !applyFilterRow(row, predicate)],\n    [\"$nor\", (row, predicates) => !predicates.some(p => applyFilterRow(row,p))],\n\n    /* comparison operators */\n    [\"$eq\",  (rowValue, filterValue) => rowValue === filterValue],\n    [\"$ne\",  (rowValue, filterValue) => rowValue !== filterValue],\n    [\"$gt\",  (rowValue, filterValue) => rowValue > filterValue],\n    [\"$gte\", (rowValue, filterValue) => rowValue >= filterValue],\n    [\"$lt\",  (rowValue, filterValue) => rowValue < filterValue],\n    [\"$lte\", (rowValue, filterValue) => rowValue <= filterValue],\n    [\"$in\",  (rowValue, filterValue) => filterValue.includes(rowValue)],\n    [\"$nin\", (rowValue, filterValue) => !filterValue.includes(rowValue)],\n]);\n\n//# sourceURL=webpack://%5Bname%5D/./src/dataframe/transforms/filter.js?");

/***/ }),

/***/ "./src/dataframe/transforms/fulljoin.js":
/*!**********************************************!*\
  !*** ./src/dataframe/transforms/fulljoin.js ***!
  \**********************************************/
/*! exports provided: fullJoin */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, \"fullJoin\", function() { return fullJoin; });\n/* harmony import */ var _dataFrame__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../dataFrame */ \"./src/dataframe/dataFrame.js\");\n\n\nfunction fullJoin(joinParams, joinKey = joinParams[0].dataFrame.key) {\n    \n    return joinParams\n        .reduce((params, param) => {\n            const baseParam = params.find(baseParam => baseParam.dataFrame === param.dataFrame);\n            if (baseParam)\n                Object.keys(param.projection).forEach(key => {\n                    baseParam.projection[key] = param.projection[key];\n                });\n            else\n                params.push(param);\n            return params;\n        }, [])\n        .reduce(\n            _fullJoin, \n            Object(_dataFrame__WEBPACK_IMPORTED_MODULE_0__[\"DataFrame\"])([], joinKey)\n        );\n\n}\n\n/**\n * Full join. Impure: Modifies left df. Left key is join key. Right key must contain all join key fields (can't use regular fields for joining).\n * @param {DataFrame} left DataFrame used as base for join\n * @param {*} rightCfg { dataFrame: DataFrame, projection: { origField: projField } }\n */\nfunction _fullJoin(left, rightCfg) {\n    // join or copy right rows onto result\n    const joinKey = left.key;\n    const dataKey = rightCfg.dataFrame.key;\n    const projection = normalizeProjection(rightCfg.projection) || {};\n\n    if (!joinKey.every(dim => dataKey.includes(dim)))\n        console.warn(\"Right key does not contain all join fields.\", { left: left, right: rightCfg });\n    if (!projection || Object.keys(projection).length === 0)\n        console.warn(\"No projection given for join so no new fields will be joined\", { left: left, right: rightCfg } );\n\n    for (let [keyStr, rightRow] of rightCfg.dataFrame) {\n        const leftRow = getOrCreateRow(left, joinKey, rightRow, keyStr)  \n        // project with aliases        \n        for(let key in projection) {\n            leftRow[projection[key]] = rightRow[key];\n        }\n    }\n\n    return left;\n}\n\n// change array [\"geo\",\"year\"] to { geo: \"geo\", year: \"year\" }\nfunction normalizeProjection(projection) {\n    if (!Array.isArray(projection))\n        return projection;\n    \n    return projection.reduce((obj, field) => {\n        obj[field] = field;\n        return obj;\n    }, {});\n}\n\nfunction createObj(space, row, keyStr) {\n    const obj = {\n        [Symbol.for('key')]: keyStr\n    };\n    space.forEach(dim => obj[dim] = row[dim])\n    return obj;\n}\n\nfunction getOrCreateRow(df, keyArr, row, keyStr) {\n    let obj;\n    // if (keyStr == undefined) keyStr = createMarkerKey(row, keyArr);\n    if (!df.hasByObjOrStr(row, keyStr)) {\n        obj = createObj(keyArr, row, keyStr);\n        df.set(obj, keyStr);\n    } else {\n        obj = df.getByObjOrStr(row, keyStr);\n    }\n    return obj;\n}\n\n//# sourceURL=webpack://%5Bname%5D/./src/dataframe/transforms/fulljoin.js?");

/***/ }),

/***/ "./src/dataframe/transforms/group.js":
/*!*******************************************!*\
  !*** ./src/dataframe/transforms/group.js ***!
  \*******************************************/
/*! exports provided: groupBy */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, \"groupBy\", function() { return groupBy; });\n/* harmony import */ var _dataFrameGroup__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../dataFrameGroup */ \"./src/dataframe/dataFrameGroup.js\");\n\n\nfunction groupBy(df, groupKey, memberKey = df.key) {\n\n    return Object(_dataFrameGroup__WEBPACK_IMPORTED_MODULE_0__[\"DataFrameGroupMap\"])(df, groupKey, memberKey);\n    \n}\n\n\n\n//# sourceURL=webpack://%5Bname%5D/./src/dataframe/transforms/group.js?");

/***/ }),

/***/ "./src/dataframe/transforms/interpolate.js":
/*!*************************************************!*\
  !*** ./src/dataframe/transforms/interpolate.js ***!
  \*************************************************/
/*! exports provided: interpolate */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, \"interpolate\", function() { return interpolate; });\n\nfunction interpolate(df) {\n    return interpolateAllFields(df);\n}\n\nfunction interpolateAllFields(df) {\n    for (let field of df.fields) {\n        interpolateField(df, field);\n    }\n    return df;\n}\n\nfunction interpolateField(df, field) {\n    let prevVal = null;\n    let gapRows = [];\n    for (let row of df.values()) {\n        const fieldVal = row[field];\n        if (fieldVal === undefined || fieldVal === null) {\n            gapRows.push(row);\n        } else {\n            // fill gap if it exists and is inner\n            if (prevVal != null && gapRows.length > 0) {\n                interpolateGap(gapRows, prevVal, fieldVal, field);\n            }\n            gapRows = [];\n            prevVal = fieldVal;\n        }\n    }\n}\n\nfunction interpolateGap(gapRows, startVal, endVal, field) {\n    const int = d3.interpolate(startVal, endVal);\n    const delta = 1 / (gapRows.length+1);\n    let mu = 0;\n    for (let gapRow of gapRows) {\n        mu += delta;\n        gapRow[field] = int(mu);\n    }\n}\n\n//# sourceURL=webpack://%5Bname%5D/./src/dataframe/transforms/interpolate.js?");

/***/ }),

/***/ "./src/dataframe/transforms/leftjoin.js":
/*!**********************************************!*\
  !*** ./src/dataframe/transforms/leftjoin.js ***!
  \**********************************************/
/*! exports provided: leftJoin */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, \"leftJoin\", function() { return leftJoin; });\n/* harmony import */ var _copycolumn__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./copycolumn */ \"./src/dataframe/transforms/copycolumn.js\");\n/* harmony import */ var _utils__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ../utils */ \"./src/dataframe/utils.js\");\n/* harmony import */ var _dataFrame__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ../dataFrame */ \"./src/dataframe/dataFrame.js\");\n\n\n\n\n        // TODO: add check for non-marker space dimensions to contain only one value\n        // -> save first row values and all next values should be equal to first\n\n/**\n * Join right on left with overlapping columns of key as join columns.\n * @param {*} left \n * @param  {...any} rights \n */\nfunction leftJoin(left, rights) {\n    const leftDf = left.dataFrame;\n    const leftKey = leftDf.key;\n    \n    const rightCopies = rights.filter(r => leftKey.some(d => d in r.projection));\n    rights = rights.filter(r => !rightCopies.includes(r)).map(r => { \n        const sameKey = Object(_utils__WEBPACK_IMPORTED_MODULE_1__[\"arrayEquals\"])(r.dataFrame.key, leftKey);\n        r.hasFn = sameKey ? \"hasByObjOrStr\" : \"has\";\n        r.getFn = sameKey ? \"getByObjOrStr\" : \"get\";\n        return r;\n    });\n\n    const result = Object(_dataFrame__WEBPACK_IMPORTED_MODULE_2__[\"DataFrame\"])([], leftKey)\n\n    for (let [keyStr, row] of leftDf) {\n        // left row as base\n        const leftRow = cloneRow(row);\n        \n        // join any rows in right dfs which have same key as left row\n        for (let { dataFrame, projection, hasFn, getFn } of rights) {\n            if (dataFrame[hasFn](row, keyStr)) {\n                const rightRow = dataFrame[getFn](row, keyStr);\n                for(let key in projection) {\n                    leftRow[projection[key]] = rightRow[key];\n                }\n            }\n        }\n        \n        // set row\n        result.set(leftRow, keyStr);\n    }\n    for (let right of rightCopies) {\n        // weird chrome bug: using for(let col in right.projection) in combination with \n        // assigning right.projection[col] to var or passing into function crashes chrome\n        // therefore for...of w/ object.keys\n        // for(let col in right.projection) {\n        for (let col of Object.keys(right.projection)) { \n            Object(_copycolumn__WEBPACK_IMPORTED_MODULE_0__[\"copyColumn\"])(result, col, right.projection[col]); \n        }   \n    }\n    return result;\n}\n\nfunction joinRows(...rows) {\n    return Object.assign(...rows);\n}\nfunction cloneRow(row) {\n    return joinRows({}, row);\n}\n\n\n//# sourceURL=webpack://%5Bname%5D/./src/dataframe/transforms/leftjoin.js?");

/***/ }),

/***/ "./src/dataframe/transforms/order.js":
/*!*******************************************!*\
  !*** ./src/dataframe/transforms/order.js ***!
  \*******************************************/
/*! exports provided: order */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, \"order\", function() { return order; });\n/* harmony import */ var _dataFrame__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../dataFrame */ \"./src/dataframe/dataFrame.js\");\n\n\nconst directions = {\n    ascending: 1,\n    decending: -1\n}\n\nfunction order(df, order_by = []) {\n    if (order_by.length == 0) return df;\n\n    const data = Array.from(df.values());\n    const orderNormalized = normalizeOrder(order_by);\n    const n = orderNormalized.length;\n\n    data.sort((a,b) => {\n        for (var i = 0; i < n; i++) {\n            const order = orderNormalized[i];\n            if (a[order.concept] < b[order.concept])\n                return -1 * order.direction;\n            else if (a[order.concept] > b[order.concept])\n                return order.direction;\n        } \n        return 0;\n    });\n\n    return Object(_dataFrame__WEBPACK_IMPORTED_MODULE_0__[\"DataFrame\"])(data, df.key);\n}\n\n/**    \n * Process [\"geo\"] or [{\"geo\": \"asc\"}] to [{ concept: \"geo\", direction: 1 }];\n * @param {} order \n */\nfunction normalizeOrder(order_by) {\n    if (typeof order_by === \"string\") \n        return [{ concept: order_by, direction: directions.ascending }];\n    return order_by.map(orderPart => {\n        if (typeof orderPart == \"string\") {\n            return { concept: orderPart, direction: directions.ascending };\n        }\telse {\n            const concept   = Object.keys(orderPart)[0];\n            const direction = orderPart[concept] == \"asc\" \n                ? directions.ascending \n                : directions.decending;\n            return { concept, direction };\n        }\n    });\n}\n\n//# sourceURL=webpack://%5Bname%5D/./src/dataframe/transforms/order.js?");

/***/ }),

/***/ "./src/dataframe/transforms/project.js":
/*!*********************************************!*\
  !*** ./src/dataframe/transforms/project.js ***!
  \*********************************************/
/*! exports provided: project */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, \"project\", function() { return project; });\n/* harmony import */ var _fulljoin__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./fulljoin */ \"./src/dataframe/transforms/fulljoin.js\");\n\n\n// use projection feature of full join\nconst project = (df, projection) => Object(_fulljoin__WEBPACK_IMPORTED_MODULE_0__[\"fullJoin\"])([{ dataFrame: df, projection: projection }]);\n\n//# sourceURL=webpack://%5Bname%5D/./src/dataframe/transforms/project.js?");

/***/ }),

/***/ "./src/dataframe/transforms/reindex.js":
/*!*********************************************!*\
  !*** ./src/dataframe/transforms/reindex.js ***!
  \*********************************************/
/*! exports provided: reindex */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, \"reindex\", function() { return reindex; });\n/* harmony import */ var _dataFrame__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ../dataFrame */ \"./src/dataframe/dataFrame.js\");\n\n\n// TODO: add check if there are rows that are don't fit stepfn \n// (iterate over df and match one step of stepfn with step of iteration)\nfunction reindex(df, stepGen) {\n    const empty = createEmptyRow(df.fields);\n    const result = Object(_dataFrame__WEBPACK_IMPORTED_MODULE_0__[\"DataFrame\"])([], df.key);\n    const index = df.key[0]; // supports only single indexed\n    for (let key of stepGen()) {\n        const keyObj = { [index]: key };\n        const row = df.has(keyObj) \n            ? df.get(keyObj)\n            : Object.assign({ }, empty, keyObj);\n        result.set(row);\n    }\n    return result;\n}\n\nfunction createEmptyRow(fields) {\n    const obj = {};\n    for (let field of fields) obj[field] = null;\n    return obj;\n}\n\n//# sourceURL=webpack://%5Bname%5D/./src/dataframe/transforms/reindex.js?");

/***/ }),

/***/ "./src/dataframe/utils.js":
/*!********************************!*\
  !*** ./src/dataframe/utils.js ***!
  \********************************/
/*! exports provided: getIter, isDataFrame, arrayEquals, intersect, isNonNullObject, normalizeKey, createKeyStr, createKey2, isNumeric, esc, createMarkerKey, createKeyFn, parseMarkerKey, pick, unique, curry, compose, pipe, rangeIndex, mapToObject */
/***/ (function(module, __webpack_exports__, __webpack_require__) {

"use strict";
eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, \"getIter\", function() { return getIter; });\n/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, \"isDataFrame\", function() { return isDataFrame; });\n/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, \"arrayEquals\", function() { return arrayEquals; });\n/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, \"intersect\", function() { return intersect; });\n/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, \"isNonNullObject\", function() { return isNonNullObject; });\n/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, \"normalizeKey\", function() { return normalizeKey; });\n/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, \"createKeyStr\", function() { return createKeyStr; });\n/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, \"createKey2\", function() { return createKey2; });\n/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, \"isNumeric\", function() { return isNumeric; });\n/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, \"esc\", function() { return esc; });\n/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, \"createMarkerKey\", function() { return createMarkerKey; });\n/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, \"createKeyFn\", function() { return createKeyFn; });\n/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, \"parseMarkerKey\", function() { return parseMarkerKey; });\n/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, \"pick\", function() { return pick; });\n/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, \"unique\", function() { return unique; });\n/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, \"curry\", function() { return curry; });\n/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, \"compose\", function() { return compose; });\n/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, \"pipe\", function() { return pipe; });\n/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, \"rangeIndex\", function() { return rangeIndex; });\n/* harmony export (binding) */ __webpack_require__.d(__webpack_exports__, \"mapToObject\", function() { return mapToObject; });\nfunction getIter(iter) {\n    if (\"values\" in iter && typeof iter.values === \"function\")\n        return iter.values();\n    return iter;\n}\n\nfunction isDataFrame(data) {\n    return \"hasByObjOrStr\" in data && typeof data.hasByObjOrStr === \"function\";\n}\n\n// returns true if a and b are identical, regardless of order (i.e. like sets)\nfunction arrayEquals(a, b) {\n    const overlap = intersect(a, b);\n    return overlap.length == a.length && overlap.length == b.length;\n}\n\n// intersect of two arrays (representing sets)\n// i.e. everything in A which is also in B\nfunction intersect(a, b) {\n    return a.filter(e => b.includes(e));\n}\n\nfunction isNonNullObject(value) {\n    return !!value && typeof value === 'object'\n}\n\nfunction normalizeKey(key) {\n    return key.slice(0).sort();\n}\n\nconst createKeyStr = (key) => key.map(esc).join('-');\n\nconst createKey2 = (space, row) => space.map(dim => row[dim]).join('-');\n// micro-optimizations below as this is code that runs for each row in data to create key to the row\n\nconst isNumeric = (n) => !isNaN(n) && isFinite(n);\n\n// TODO: probably use different replace function, long version in jsperf\n// string replace functions jsperf: https://jsperf.com/string-replace-methods\n// regexp not here, not fast in any browser\n/**\n * Verbose string replace using progressive indexOf. Fastest in Chrome.\n * Does not manipulate input string.\n * @param {*} str Input string\n * @param {*} ndl Needle to find in input string\n * @param {*} repl Replacement string to replace needle with\n */\nfunction replace(str, ndl, repl) {\n    var outstr = '',\n        start = 0,\n        end = 0,\n        l = ndl.length;\n    if (!str && str !== \"\" || str === undefined) debugger;\n    while ((end = str.indexOf(ndl, start)) > -1) {\n        outstr += str.slice(start, end) + repl;\n        start = end + l;\n    }\n    return outstr + str.slice(start);\n}\n// fastest in firefox\nfunction replace_sj(str, ndl, repl) {\n    return str.split(ndl).join(repl);\n}\n\nfunction isString(str) {\n    typeof str === \"string\";\n}\n\n// precalc strings for optimization\nconst escapechar = \"\\\\\";\nconst joinchar = \"-\";\nconst dblescape = escapechar + escapechar;\nconst joinescape = escapechar + joinchar;\nvar esc = str => {\n    if (str instanceof Date) str = str.toISOString();\n    if (isNumeric(str)) return str;\n    return replace(replace(str, escapechar, dblescape), joinchar, joinescape);\n}\n\n// jsperf of key-creation options. Simple concat hash + escaping wins: https://jsperf.com/shallow-hash-of-object\n// for loop is faster than keys.map().join('-');\n// but in Edge, json.stringify is faster\n// pre-escaped space would add extra performance\nconst createDimKeyStr = (dim, dimVal) => {\n    if (dimVal instanceof Date) dimVal = dimVal.toISOString();\n    //if (!dim || !dimVal) debugger;\n    return esc(dim) + joinchar + esc(dimVal);\n}\nconst createMarkerKey = (row, space = Object.keys(row).sort()) => {\n    const l = space.length;\n\n/*    if (l===1)\n        return createDimKeyStr(space[0],row[space[0]]+\"\";\n*/\n\n    // space.map(c => createDimKeyStr(row[c]))).join(joinchar);\n    var res = (l > 0) ? createDimKeyStr(space[0], row[space[0]]) : '';\n    for (var i = 1; i < l; i++) {\n        res += joinchar + createDimKeyStr(space[i], row[space[i]]);\n    }\n    return res\n}\n\nconst createKeyFn = (space) => {\n    const spaceEsc = space.map(esc);\n    const l = space.length;\n    return (row) => {\n        const parts = [];\n        let field, i, j;\n        for (i = j = 0; i < l; i++, j+=2) {\n            parts[j] = field = spaceEsc[i]; \n            parts[j+1] = esc(row[field]);\n        }\n        return parts.join(joinchar);\n    }\n}\n\nfunction parseMarkerKey(str) {\n    // \"remove\" escaping by splitting to be able to split on actual joins\n    // then, put it back together\n    var parts = str.split(dblescape).map(\n        s => s.split(joinescape).map(\n            s => s.split(joinchar)\n        )\n    )\n    var values = [];\n    var val = '';\n    for (let i = 0; i < parts.length; i++) {\n        for (let j = 0; j < parts[i].length; j++) {\n            for (let k = 0; k < parts[i][j].length; k++) {\n                // double escape found, glue again with escape char\n                if (j === 0 && k === 0) {\n                    if (i !== 0) val += escapechar;\n                    val += parts[i][j][k];\n                } \n                // joinescape found, glue again with join char\n                else if (k === 0) {\n                    if (j !== 0) val += joinchar;\n                    val += parts[i][j][k]\n                }\n                // actual joinchar found, correct split\n                else {\n                    values.push(val);\n                    val = parts[i][j][k];    \n                }\n            }\n        }\n    }\n    values.push(val);\n\n    // create key, odd is dim, even is dimension value\n    const key = {};\n    for (let i = 0; i < values.length; i += 2) {\n        key[values[i]] = values[i+1];\n    }\n    return key;\n}\n\n// end micro-optimizations\n\nfunction pick(object, keys) {\n    return keys.reduce((obj, key) => {\n        if (object[key]) {\n            obj[key] = object[key];\n        }\n        return obj;\n        }, {});\n}\n\nfunction unique(...arrays) {\n    const uniqueSet = new Set(arrays.flat());\n    return Array.from(uniqueSet);\n}\n\n/**\n * Creates an auto-curried function out of the supplied function. An autocurried function can be applied either in a curried fashion or normally.\n * E.g. fn(a,b,c) can be called like fn(a)(b)(c) or f(a, b)(c) or f(a,b,c) or f(a)(b, c) or f()(a,b,c) etc\n * @param {Function} fn \n * @returns {Function} autocurried\n */\nfunction curry(fn) {\n    /* need to specify arity this way since Function.length \n     * does not include rest arguments (...rest) which are used \n     * in the partial function (which is curried too ) \n     */\n    function curryN(arity, fn) {\n        return function curried(...args) {\n            if (arity < args.length) {\n                function partial(...otherArgs) {\n                    fn(...args, ...otherArgs);\n                }\n                return curryN(arity - args.length, partial);\n            } else {\n                return fn(...args);\n            }\n        }\n    }\n    return curryN(fn.length, fn);\n\n    /* identical big-arrow implementation\n    const curryN = (arity, fn) => (...args) => \n        arity < args.length\n            ? curryN(arity - args.length, (...restArgs) => fn(...args, ...restArgs))\n            : fn(...args) \n\n    return curryN(fn.length, fn);\n    */\n}\n\nfunction compose2(f, g) {\n    return (...args) => f(g(...args));\n}\nfunction compose(...fns) {\n    return fns.reduce(compose2);\n}\nfunction pipe(...fns) {\n    return fns.reduceRight(compose2);\n}\n\nfunction rangeIndex(index = 0) {\n    return (row, key) => index++;\n}\n\nfunction mapToObject(map) {\n    const result = {};\n    for ([key, group] of groupMap) {\n        result[key] = group.toJSON();\n    }\n    return result;\n}\n\n//# sourceURL=webpack://%5Bname%5D/./src/dataframe/utils.js?");

/***/ })

/******/ })["default"];
});