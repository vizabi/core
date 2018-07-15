import dataStore from './dataStore'
import appState from './appState'
import { observable, action, reaction } from 'mobx'
import * as d3 from 'd3'

export default window.encodingStore = observable.map([
    [
        "size", {
            extent: [0, 20],
            which: "POP",
            dataSource: dataStore.get("gap"),
            get data() {
                return this.dataSource.data.get();
            },
            get d3Scale() {
                return d3.scaleSqrt().range(this.extent).domain(this.domain);
            },
            get domain() {
                return d3.extent(this.data, d => +d[this.which]);
            }
        }
    ],
    [
        "color", {
            which: "world_region",
            dataSource: dataStore.get("gap"),
            get data() {
                return this.dataSource.data.get();
            }
        }
    ],
    [
        "frame", {
            which: "time",
            dataSource: dataStore.get("gap"),
            value: 1990,
            speed: 600,
            playing: false,
            timeout: null,
            domain: [1990, 2014],
            get data() {
                return this.dataSource.data.get();
            },
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
            modifyDataMap: function(dataMap, space) {
                const frameSpace = space.filter(dim => dim != this.which);
                for (let [key, row] of dataMap) {
                    if (row[this.which] == this.value) {
                        const key = createKey(frameSpace, row);
                        row[Symbol.for('key')] = key;
                    } else {
                        dataMap.delete(key)
                    }
                }
            },
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
        }
    ],
    [
        "y", {
            which: "LEX",
            dataSource: dataStore.get("gap"),
            get data() {
                return this.dataSource.data.get();
            }
        }
    ],
    [
        "x", {
            which: "GDP",
            dataSource: dataStore.get("gap"),
            scale: "linear",
            get data() {
                return this.dataSource.data.get();
            },
            get d3Scale() {
                const scale = this.scale == "linear" ? d3.scaleLinear() : d3.scaleLog();
                return scale.range(this.range).domain(this.domain);
            },
            get range() {
                return [0, appState.width]
            },
            get domain() {
                return d3.extent(this.data, d => +d[this.which]);
            }
        }
    ]

]);

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


const createKey = (space, row) => space.map(dim => row[dim]).join('-');