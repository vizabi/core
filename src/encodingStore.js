import dataStore from './dataStore'
import appState from './appState'
import { assign, createKey } from './utils'
import { observable, action, reaction } from 'mobx'

const encodingConfig = {
    x: {
        type: "x",
        which: "GDP",
        dataSource: "gap2",
        scale: "log"
    },
    y: {
        type: "y",
        which: "LEX",
        dataSource: "gap2",
        scale: "linear"
    },
    size: {
        type: "size",
        which: "POP",
        dataSource: "gap2",
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
            scale: "linear",
            dataSource: dataStore.get("data"),
            get data() {
                return this.dataSource.data.get();
            },
            get range() {
                return (this.scale == "ordinal") ?
                    d3.schemeCategory10 : [0, 1];
            },
            get d3Scale() {
                const scale = scales[this.scale]();
                const domain = (this.scale == "log" && this.domain[0] == 0) ? [1, this.domain[1]] : this.domain;
                return scale.range(this.range).domain(domain);
            },
            get domain() {
                return (["ordinal", "point"].includes(this.scale)) ?
                    d3.set(this.data, d => d[this.which]).values().sort() :
                    d3.extent(this.data, d => d[this.which]);
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
                    // need to overwrite this way because it might be a getter
                    delete obj[prop];
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
            get range() {
                return [0, 20]
            }
        }),
        x: () => ({
            get range() {
                return [0, appState.width]
            }
        }),
        y: () => ({
            get range() {
                return [appState.height, 0]
            }
        }),
        color: () => ({
            get range() {
                return d3.schemeCategory10;
            }
        }),
        frame: () => ({
            value: (new Date()).getFullYear(),
            speed: 100,
            playing: false,
            timeout: null,
            startPlaying: action(function() {
                if (this.value == this.domain[1])
                    this.value = this.domain[0];
                this.playing = true;
            }),
            stopPlaying: action(function() {
                this.playing = false;
            }),
            update: action(function() {
                if (this.playing) {
                    if (this.value == this.domain[1])
                        this.stopPlaying();
                    else {
                        this.value++;
                        //this.timeout = setTimeout(this.update.bind(this), this.speed);
                    }
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



export default encodingStore;