import { assign, applyDefaults, clamp } from "../utils";
import { action, computed, observable, reaction, trace } from "mobx";
import { baseEncoding } from "./baseEncoding";
import { DataFrameGroup } from "../../dataframe/dataFrameGroup";
import { DataFrame } from "../../dataframe/dataFrame";
import { createKeyFn } from "../../dataframe/dfutils";

const defaultConfig = {
    data: {
        concept: undefined,
        space: undefined,
        filter: { 
            modelType: "trailFilter",
            markers: {}, 
        } 
    }
}

const defaults = {
    show: true,
    updateStarts: true,
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
            const group = this.dataMapBeforeTransform("addPreviousTrailHeads");
            return group.extentOfGroupKeyPerMarker(this.data.filter.markers.keys())
        },
        /**
         * Set trail start of every bubble to `value` if value is lower than current trail start
         */
        updateTrailStart: action('update trail start', function updateTrailStart(
            value = this.frameEncoding.value, 
            limits = this.limits
        ) {
            let key, min, max;
            for (key in this.starts) {
                [min, max] = limits[key];
                max = d3.min([max, this.starts[key]]);
                this.data.filter.set(key, value, [min, max]);
            }
        }),
        /**
         * Object of parsed trail starts from config
         */
        get starts() {
            if (!this.updateStarts) return oldStarts;
            const starts = {};
            for (let [key, payload] of this.data.filter.markers) {
                // need to clamp here too because starts may be invalid in user config or when switching data
                const limits = this.limits[key];
                if (limits.some(n => n == undefined))
                    continue; // skip starts that aren't even in data
                const configValue = this.frameEncoding.parseValue(payload);
                starts[key] = clamp(configValue, ...limits);
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
                for (let key of this.data.filter.markers.keys()) 
                    this.data.filter.set(key)
            }
        }),
        get transformationFns() {
            return {
                'addPreviousTrailHeads': this.addPreviousTrailHeads.bind(this),
                'addTrails': this.addTrails.bind(this)
            }
        },
        /**
         * Trails are all sorted together at the position of their head.
         * So we first add heads, then we can order markers and then we can add the rest of the trail
         * @param {*} group 
         * @returns 
         */
        addPreviousTrailHeads(group) {
            const trailMarkerKeys = Object.keys(this.starts);
            if (trailMarkerKeys.length == 0 || !this.show)
                return group;

            const newGroup = DataFrameGroup([], group.key, group.descendantKeys);
            const trailHeads = new Map();
            for (let [id, frame] of group) {
                const keyObj = group.keyObject(frame);
                const historicalTrails = new Set();
                for (let trailMarkerKey of trailMarkerKeys) {
                    // current group doesn't have a head for this trail that has already passed
                    if (!frame.hasByStr(trailMarkerKey)) {
                        if (trailHeads.has(trailMarkerKey)) {
                            historicalTrails.add(trailMarkerKey);
                        }
                    } else {
                        const trailMarker = frame.getByStr(trailMarkerKey);
                        trailHeads.set(trailMarkerKey, trailMarker);
                    }
                }

                const newFrame = frame.copy();
                for (let trailMarkerKey of historicalTrails) {
                    const trailHead = trailHeads.get(trailMarkerKey);
                    newFrame.set(trailHead);
                }
                newGroup.set(keyObj, newFrame);
            }
            return newGroup;
        },
        /**
         *  Per given marker, in whatever ordered group
         *  1. get markers from groups before its group (possibly starting at given group)
         *  2. add those markers to current group, with new key including original group (so no collission)
         * @param {*} group 
         */
        addTrails(group) {

            // can't use this.groupDim because circular dep this.marker.transformedDataMap
            const groupDim = group.key[0]; // supports only 1 dimensional grouping
            const markerKeys = Object.keys(this.starts);

            if (markerKeys.length == 0 || !this.show)
                return group;

            // create trails
            const trails = new Map();
            for (let key of markerKeys) {
                const trail = new Map();
                trails.set(key, trail);
                for (let [i, frame] of group) {
                    if (frame.hasByStr(key))
                        trail.set(i, assign({}, frame.getByStr(key)));
                }
            }

            // add trails to groups
            const prop = groupDim;
            const newGroup = DataFrameGroup([], group.key, group.descendantKeys);
            const trailKeyDims = [...group.descendantKeys[0], prop];
            const trailKeyFn = createKeyFn(trailKeyDims);
            for (let [id, frame] of group) {
                const keyObj = group.keyObject(frame);
                const newFrame = DataFrame([], frame.key);
                for (let [markerKey, markerData] of frame) {
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
                            const newKey = trailKeyFn(trailMarker);
                            const newData = Object.assign(trailMarker, {
                                [Symbol.for('key')]: newKey,
                                [Symbol.for('trailHeadKey')]: markerKey
                            });
                            newFrame.set(newData, newKey);
                        }
                    }
                    // (head) marker
                    newFrame.set(markerData, markerKey);
                }
                newGroup.set(keyObj, newFrame);
            }
            return newGroup;
        },
        onCreate() {
            const updateTrailDestruct = reaction(
                // wait for marker state, as we need transformeddatamaps for limits
                () => this.marker.state == 'fulfilled' ? this.frameEncoding.ceilKeyFrame() : false,
                (value) => { if (value) this.updateTrailStart(value) }, 
                { name: "updateTrailStart on frame value change" }
            );
            this.destructers.push(updateTrailDestruct);
            const configLoopbackDestruct = reaction(
                () => this.marker.state == 'fulfilled' ? this.starts : undefined,
                (starts) => {
                    // this.starts may have excluded configured markers because they're not
                    // available in data. This loops that data-informed exclusion back to 
                    // config.
                    if (starts) {
                        const filter = this.data.filter;
                        for (let key of filter.markers.keys()) {
                            if (!(key in starts))
                                filter.delete(key);
                        }
                    }
                },
                { name: "trail config loopback" }
            );
            this.destructers.push(configLoopbackDestruct);
        }
    });
}

trail.decorate = {
    starts: computed.struct,
    limits: computed.struct
}