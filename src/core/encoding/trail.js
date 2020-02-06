import { assign, applyDefaults, isString } from "../utils";
import { action, trace } from "mobx";
import { baseEncoding } from "./baseEncoding";
import { DataFrameGroupMap } from "../../dataframe/dataFrameGroup";
import { DataFrame } from "../../dataframe/dataFrame";
import { parseMarkerKey, createMarkerKey } from "../../dataframe/utils";
import { resolveRef } from "../vizabi";

const defaultConfig = {
    starts: {},
    data: { filter: { markers: {} } }
}

const defaults = {
    show: true,
    groupDim: null,
    starts: {}
}

export function trail(config, parent) {

    applyDefaults(config, defaultConfig);

    const base = baseEncoding(config, parent);

    return assign(base, {
        get show() { 
            return this.config.show || (typeof this.config.show === "undefined" && defaults.show) },
        get groupDim() {
            return resolveRef(this.config.groupDim) || defaults.groupDim;
        },
        get limits() {
            trace();
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
        updateTrailStart: action('update trail start', function(value) {
            for (let key in this.config.starts) {
                const start = this.config.starts[key];
                this.config.starts[key] = start < value ? start : value;
            }
        }),

        get starts() {
            const starts = {};
            for (let key in this.limits) {
                const start = this.config.starts[key];
                const minLimit = this.limits[key][0];
                starts[key] = start > minLimit ? start : minLimit; // Math.max(this.config.starts[key], this.limits[key][0]);
            }
            return starts;
        },
        setShow: action(function(show) {
            this.config.show = show;
            if (show === false) this.config.starts = defaults.starts;
        }),
        setTrail: action(function(d) {
            const key = this.getKey(d);
            this.config.starts[key] = d[this.groupDim]; // group key
            this.data.filter.set(d);
        }),
        deleteTrail: action(function(d) {
            const key = this.getKey(d);
            delete this.config.starts[key]; // group key
            this.data.filter.delete(d);
        }),
        getKey(d) {
            return isString(d) ? d : d[Symbol.for('key')];
        },
        get transformationFns() {
            return {
                'addTrails': this.addTrails.bind(this)
            }
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
                        for (let keyStr of groupMap.keys()) {
                            const i = groupMap.get(keyStr).values().next().value[prop]
                            //const i = parseMarkerKey(keyStr)[prop];
                            if (i < trailStart || !trail.has(keyStr)) continue;
                            if (i >= trailEnd) break;
                            const trailMarker = trail.get(keyStr);
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