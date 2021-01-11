// http://vizabi.org v1.0.1 Copyright 2020 undefined
(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports) :
    typeof define === 'function' && define.amd ? define(['exports'], factory) :
    (global = global || self, factory(global.Dataframe = {}));
}(this, (function (exports) { 'use strict';

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
    function arrayEquals(a, b) {
        const overlap = intersect(a, b);
        return overlap.length == a.length && overlap.length == b.length;
    }

    // intersect of two arrays (representing sets)
    // i.e. everything in A which is also in B
    function intersect(a, b) {
        return a.filter(e => b.includes(e));
    }

    function isNonNullObject(value) {
        return !!value && typeof value === 'object'
    }

    function normalizeKey(key) {
        return key.slice(0).sort();
    }
    // micro-optimizations below as this is code that runs for each row in data to create key to the row

    const isNumeric = (n) => !isNaN(n) && isFinite(n);

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
        if (isNumeric(str)) return str;
        return replace(replace(str, escapechar, dblescape), joinchar, joinescape);
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
            const sameKey = arrayEquals(r.dataFrame.key, leftKey);
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
        if (isNonNullObject(fillValues)) {
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

    exports.DataFrame = DataFrame;

    Object.defineProperty(exports, '__esModule', { value: true });

})));
//# sourceMappingURL=Dataframe.js.map
