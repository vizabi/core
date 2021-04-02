import { assign, applyDefaults, isString, configValue, parseConfigValue, clamp } from "../utils";
import { action, computed, observable, reaction, trace } from "mobx";
import { baseEncoding } from "./baseEncoding";
import { DataFrameGroupMap } from "../../dataframe/dataFrameGroup";
import { DataFrame } from "../../dataframe/dataFrame";
import { createMarkerKey } from "../../dataframe/dfutils";

const defaultConfig = {
    starts: {},
    data: {
        concept: undefined,
        space: undefined,
        filter: { markers: {} } 
    }
}

const defaults = {
    show: true,
    updateStarts: true,
    starts: {},
    frameEncoding: "frame"
}
export function trail(config, parent) {
    return observable(trail.nonObservable(config, parent));
}

trail.nonObservable = function(config, parent) {

    applyDefaults(config, defaultConfig);

    const base = baseEncoding.nonObservable(config, parent);
    let oldStarts = {};

    return assign(base, {
        get show() { 
            return typeof this.config.show == 'boolean' ? this.config.show : defaults.show
        },
        get groupDim() {
            return this.frameEncoding.data.concept;
        },
        get frameEncoding() {
            const frameEncoding = this.config.frameEncoding || defaults.frameEncoding;
            return this.marker.encoding[frameEncoding];
        },
        /**
         * For each trailed marker, get the min-max of the trail. 
         */
        get limits() {
            // get datamap that's also used as input for addTrails
            const groupMap = this.dataMapBeforeTransform("addTrails");
            return groupMap.extentOfGroupMapKeyPerMarker(Object.keys(this.starts))
        },
        /**
         * Set trail start of every bubble to `value` if value is lower than current trail start
         */
        updateTrailStart: action('update trail start', 
        function updateTrailStart(value = this.frameEncoding.value, limits = this.limits) {
            let key, min, max;
            for (key in this.config.starts) {
                [min, max] = limits[key];
                max = d3.min([max, this.starts[key]]);
                this.setTrail(key, value, [min, max]);
            }
        }),
        /**
         * Object of parsed trail starts from config
         */
        get starts() {
            if (!this.updateStarts) return oldStarts;
            const starts = {};
            for (let key in this.config.starts) {
                starts[key] = parseConfigValue(this.config.starts[key], this.data.source.getConcept(this.groupDim));
            }
            return oldStarts = starts;
        },
        /**
         * Can be set to false if frame value is likely to decrease frequently (e.g. dragging a timeslider).
         * Will temporarily not update starts and thus not trigger expensive addTrails operation.
         */
        get updateStarts() {
            return typeof this.config.updateStarts == 'boolean' ?  this.config.updateStarts : defaults.updateStarts;
        },
        setShow: action(function(show) {
            this.config.show = show;
            if (show === true) {
                for (let key in this.config.starts) 
                    this.setTrail(key)
            }
        }),
        setTrail: action(function(
            d, 
            value = d[this.groupDim] || this.frameEncoding.value, 
            limit = this.limits[this.getKey(d)]
        ) {
            const key = this.getKey(d);
            if (!(key in this.config.starts) && !limit) {
                // add unclamped to starts so limits computed gets recalculated (saves redundant one-off limit calc for this key)
                this.config.starts[key] = configValue(value, this.data.source.getConcept(this.groupDim));
                limit = this.limits[key]; 
            }
            const clamped = clamp(value, limit[0], limit[1]);
            this.config.starts[key] = configValue(clamped, this.data.source.getConcept(this.groupDim));
        }),
        deleteTrail: action(function(d) {
            const key = this.getKey(d);
            delete this.config.starts[key];
        }),
        getKey(d) {
            return isString(d) ? d : d[Symbol.for('key')];
        },
        get transformationFns() {
            return {
                'addPreviousTrailHeads': this.addPreviousTrailHeads.bind(this),
                'addTrails': this.addTrails.bind(this)
            }
        },
        /**
         * Trails are all sorted together at the position of their head.
         * So we first add heads, then we can order markers and then we can add the rest of the trail
         * @param {*} groupMap 
         * @returns 
         */
        addPreviousTrailHeads(groupMap) {
            const trailMarkerKeys = Object.keys(this.starts);
            if (trailMarkerKeys.length == 0 || !this.show)
                return groupMap;

            const newGroupMap = DataFrameGroupMap([], groupMap.key, groupMap.descendantKeys);
            const trailHeads = new Map();
            for (let [id, group] of groupMap) {
                const historicalTrails = new Set();
                for (let trailMarkerKey of trailMarkerKeys) {
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
            const markerKeys = Object.keys(this.starts);

            if (markerKeys.length == 0 || !this.show)
                return groupMap;

            // create trails
            const trails = new Map();
            for (let key of markerKeys) {
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
        },
        onCreate() {
            const updateTrailDestruct = reaction(
                // wait for marker state, as we need transformeddatamaps for limits
                () => this.marker.state == 'fulfilled' ? { value: this.frameEncoding.ceilKeyFrame(), limits: this.limits } : {},
                ({ value, limits }) => { if (value) this.updateTrailStart(value, limits) }, 
                { name: "updateTrailStart on frame value change" }
            );
            this.destructers.push(updateTrailDestruct);
        }
    });
}

trail.decorate = {
    starts: computed.struct
}