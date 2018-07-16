import dataStore from './dataStore'
import appState from './appState'
import { assign, createKey } from './utils'
import { observable, action, reaction } from 'mobx'

const encodingConfig = {
    x: {
        type: "x",
        which: "GDP",
        dataSource: "gap",
        scale: "log"
    },
    y: {
        type: "y",
        which: "LEX",
        dataSource: "gap",
        scale: "linear"
    },
    size: {
        type: "size",
        which: "POP",
        dataSource: "gap",
        scale: "sqrt"
    },
    color: {
        type: "color",
        which: "world_region",
        dataSource: "gap",
        scale: "ordinal",
        range: "schemeCategory10"
    },
    frame: {
        type: "frame",
        which: "time",
        dataSource: "gap",
        value: 1990,
        speed: 200
    }
}

const scales = {
    "linear": d3.scaleLinear,
    "log": d3.scaleLog,
    "sqrt": d3.scaleSqrt,
    "ordinal": d3.scaleOrdinal,
    "point": d3.scalePoint
}

window.encodingStore = observable({
    encodings: new Map(),
    get: function(id) {
        return this.encodings.get(id);
    },
    getAll: function() {
        return this.encodings;
    },
    set: action(function(id, config) {
        this.encodings.set(id, encodingFactory(config));
    }),
    setMany: action(function(configs) {
        for (let id in configs) {
            this.set(id, configs[id]);
        }
    })
});

const encodingFactory = function(config) {

    const encodings = {
        base: () => ({
            which: "var",
            scale: null,
            dataSource: dataStore.get("data"),
            domain: null,
            range: null,
            data: null,
            get _data() {
                return this.dataSource.data.get();
            },
            get _range() {
                if (this.range != null)
                    return this.range
                return (this.scale == "ordinal") ?
                    d3.schemeCategory10 : [0, 1];
            },
            get _scale() {
                return scales[this.scale] ? this.scale : "linear";
            },
            get d3Scale() {
                const scale = scales[this._scale]();
                const domain = (this.scale == "log" && this._domain[0] == 0) ? [1, this._domain[1]] : this._domain;
                return scale.range(this._range).domain(domain);
            },
            get _domain() {
                if (this.domain != null)
                    return this.domain
                return (["ordinal", "point"].includes(this.scale)) ?
                    d3.set(this._data, d => d[this.which]).values().sort() :
                    d3.extent(this._data, d => d[this.which]);
            }

        }),
        config: config => {
            const obj = {};
            const props = ["which", "scale", "data", "domain", "range"];
            const typeProps = {
                frame: ["value", "speed"]
            }
            if (config.type && typeProps[config.type]) {
                props.push(...typeProps[config.type]);
            }
            props.forEach(prop => {
                if (config[prop]) {
                    // special case for range being a d3 color scheme
                    if (prop == "range" && Array.isArray(d3[config[prop]]))
                        obj[prop] = d3[config[prop]];
                    else
                        obj[prop] = config[prop];
                }
            });
            // special dataSource syntax
            if (config.dataSource) obj.dataSource = dataStore.get(config.dataSource);
            return obj;
        },
        size: () => ({
            scale: "sqrt",
            get _range() {
                return [0, 20]
            }
        }),
        x: () => ({
            get _range() {
                return [0, appState.width]
            }
        }),
        y: () => ({
            get _range() {
                return [appState.height, 0]
            }
        }),
        color: () => ({
            get _range() {
                return d3.schemeCategory10;
            }
        }),
        frame: () => ({
            value: (new Date()).getFullYear(),
            speed: 100,
            playing: false,
            timeout: null,
            interpolate: true,
            startPlaying: action(function() {
                if (this.value == this._domain[1])
                    this.value = this._domain[0];
                this.playing = true;
            }),
            stopPlaying: action(function() {
                this.playing = false;
            }),
            update: action(function() {
                if (this.playing) {
                    this.value++;
                    if (this.value == this._domain[1])
                        this.stopPlaying();
                    // used for timeout instead of interval timing
                    // else this.timeout = setTimeout(this.update.bind(this), this.speed);
                }
            }),
            createFrameMap: function(flatDataMap, space) {
                const frameMap = new Map();
                const frameSpace = space.filter(dim => dim != this.which);
                for (let [key, row] of flatDataMap) {
                    const dataMap = this.getOrCreateDataMap(frameMap, row);
                    const key = createKey(frameSpace, row);
                    row[Symbol.for('key')] = key;
                    dataMap.set(key, row);
                }
                if (this.interpolate)
                    this.interpolateFrames(frameMap, frameSpace);
                return frameMap;
            },
            getOrCreateDataMap(frameMap, row) {
                let dataMap;
                if (frameMap.has(row[this.which])) {
                    dataMap = frameMap.get(row[this.which]);
                } else {
                    dataMap = new Map();
                    frameMap.set(row[this.which], dataMap);
                }
                return dataMap;
            },
            interpolateFrames(frameMap, frameSpace) {
                var t0 = performance.now();

                var frames = [...frameMap.keys()].sort();
                var previousMarkerValues = new Map();
                // for each frame
                frames.forEach(frameId => {
                    // for each marker in that frame
                    for (let [markerKey, marker] of frameMap.get(frameId).entries()) {

                        // get previous values for this marker
                        let previous;
                        if (!previousMarkerValues.has(markerKey)) {
                            previous = {};
                            previousMarkerValues.set(markerKey, previous);
                        } else {
                            previous = previousMarkerValues.get(markerKey);
                        }

                        // for every property on marker
                        Object.keys(marker)
                            // remove properties without data
                            .filter(prop => marker[prop] != null)
                            .forEach(prop => {
                                // if there is a previous value and gap is > 1
                                if (previous[prop] && previous[prop].frameId + 1 < frameId) {
                                    // interpolate and save results in frameMap
                                    this.interpolatePoint(previous[prop], { frameId, value: marker[prop] })
                                        .forEach(({ frameId, value }) => {
                                            // could maybe be optimized with batch updating all interpolations
                                            let markerObj;
                                            let markerMap;

                                            // get right frame
                                            if (frameMap.has(frameId)) {
                                                markerMap = frameMap.get(frameId);
                                            } else {
                                                markerMap = new Map();
                                                frameMap.set(frameId, markerMap);
                                            }

                                            // get right marker
                                            if (markerMap.has(markerKey)) {
                                                markerObj = markerMap.get(markerKey);
                                            } else {
                                                markerObj = {
                                                    [Symbol.for('key')]: markerKey,
                                                    [this.which]: frameId
                                                }
                                                frameSpace.forEach(dim => markerObj[dim] = marker[dim]);
                                                markerMap.set(markerKey, markerObj);
                                            }

                                            // add value to marker
                                            markerObj[prop] = value;
                                        });
                                }

                                // update previous value to current
                                previous[prop] = {
                                    frameId,
                                    value: marker[prop]
                                }
                            });


                    }
                });
                var t1 = performance.now();
                console.log("Call to interpolateFrames took " + (t1 - t0) + " milliseconds.")
            },
            interpolatePoint(start, end) {
                const int = d3.interpolate(start.value, end.value);
                const delta = end.frameId - start.frameId;
                const intVals = [];
                for (let i = 1; i < delta; i++) {
                    const frameId = start.frameId + i;
                    const value = int(i / delta);
                    intVals.push({ frameId, value })
                }
                return intVals;
            }
        })
    }

    // default encoding object
    let encoding = encodings.base();

    // extend
    if (config.type && encodings[config.type])
        assign(encoding, encodings[config.type]());

    assign(encoding, encodings.config(config))

    return observable(encoding);
}

encodingStore.setMany(encodingConfig);

const frame = encodingStore.get("frame");

const controlTimer = reaction(
    function() { return { playing: frame.playing, speed: frame.speed } },
    function({ playing, speed }) {
        if (playing) {
            frame.update();
            frame.timeout = setInterval(frame.update.bind(frame), speed);
        } else frame.timeout = clearInterval(frame.timeout);
    }
);

// on which change, reset domain and scale (keep range)
for (let enc of encodingStore.getAll().values()) {
    reaction(
        function() { return { which: enc.which } },
        function({ which }) {
            enc.domain = null;
            enc.scale = null
        }
    )
}

export default encodingStore;