import { assign, applyDefaults, isString } from "../utils";
import { action } from "mobx";
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
}

export function trail(config, parent) {

    applyDefaults(config, defaultConfig);

    const base = baseEncoding(config, parent);

    return assign(base, {
        get show() { 
            return this.config.show || (typeof this.config.show === "undefined" && defaults.show) },
        get starts() {
            return this.config.starts;
        },
        get groupDim() {
            return resolveRef(this.config.groupDim) || defaults.groupDim;
        },
        get limits() {
            const markers = this.data.filter.markers;
            const frameMap = this.marker.getTransformedDataMap("order.order");

            const limits = {};

            for (let key of markers.keys()) {
                let searchStartLimit = true;
                let prevFrame;
                limits[key] = [];
                for (let [i, frame] of frameMap) {
                    if (searchStartLimit && frame.hasByObjOrStr(null,key)) {
                        limits[key].push(frame.getByObjOrStr(null,key)[this.groupDim]);
                        searchStartLimit = false;
                    }
                    if (!searchStartLimit && !frame.hasByObjOrStr(null,key)) {
                        break;
                    }
                    prevFrame = frame;
                }
                limits[key].push(prevFrame.getByObjOrStr(null,key)[this.groupDim]);
            }

            return limits;
        },
        updateTrailStart: action('update trail start', function(value) {
            this.data.filter.markers.forEach((payload, key) => {
                const start = this.starts[key];
                const limits = this.limits[key];
                if (!start || value < start)
                    this.config.starts[key] = value < limits[0] ? limits[0] : value;
            });
        }),
        setShow: action(function(show) {
            this.config.show = show;
            if (show === false) this.config.starts = {};
        }),
        setTrail: action(function(d) {
            const key = this.getKey(d);
            this.config.starts[key] = d[this.groupDim]; // frame value
            this.data.filter.set(d);
        }),
        deleteTrail: action(function(d) {
            const key = this.getKey(d);
            delete this.config.starts[key]; // frame value
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
        // per given marker, in whatever group
        //  1. get markers from groups before its group (possibly starting at given group)
        //  2. add those markers to current group, with key including original group (so no collission)
        //
        addTrails(groupedDf) {
            const frameMap = groupedDf;
            // can't use this.groupDim because circular dep this.marker.transformedDataMap
            const groupDim = groupedDf.key[0]; // supports only 1 dimensional grouping
            const markers = this.data.filter.markers;

            if (markers.size == 0 || !this.show)
                return frameMap;

            // create trails
            const trails = new Map();
            for (let key of markers.keys()) {
                const trail = new Map();
                trails.set(key, trail);
                for (let [i, frame] of frameMap) {
                    if (frame.hasByObjOrStr(null,key))
                        trail.set(i, Object.assign({}, frame.getByObjOrStr(null,key)));
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
                            const i = groupedDf.get(keyStr).values().next().value[prop]
                            //const i = parseMarkerKey(keyStr)[prop];
                            if (i < trailStart || !trail.has(keyStr)) continue;
                            if (i > trailEnd) break;
                            const trailMarker = trail.get(keyStr);
                            const newKey = createMarkerKey(trailMarker, trailKeyDims);
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
                newFrameMap.set(id, newFrame);
            }
            return newFrameMap;
        }
    });
}