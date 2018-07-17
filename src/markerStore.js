import encodingStore from './encodingStore'
import { observable } from 'mobx'
import { createKey } from './utils'
import store from './genericStore'

const markerConfig = {
    "bubbles": {
        type: "bubbles",
        space: ["geo", "time"],
        encoding: {
            "x": "x",
            "y": "y",
            "size": "size",
            "color": "color",
            "frame": "frame"
        }
    }
}

export default window.markerStore = store({
    base: () => ({
        space: ["entity", "time"],
        important: ["x", "y"],
        encoding: {
            "x": encodingStore.get("x"),
            "y": encodingStore.get("y"),
            "frame": encodingStore.get("frame")
        },
        get dataMap() {
            let dataMap = new Map();
            let dataSources = new Map();

            // get all datasources used by marker
            for (let [prop, { _data, which }] of this.encoding) {
                if (!this.space.includes(which)) {
                    if (dataSources.has(_data))
                        dataSources.get(_data).push({ which, prop });
                    else
                        dataSources.set(_data, [{ which, prop }]);
                }
            }

            // save relevant data to dataMap
            for (let [data, encodings] of dataSources) {
                data.forEach(row => {
                    const obj = getOrCreateObj(dataMap, this.space, row);
                    encodings.forEach(({ prop, which }) => {
                        obj[prop] = row[which];
                    })
                })
            }

            // remove markers which miss important values
            for (let [key, row] of dataMap)
                if (this.important.some(prop => !row.hasOwnProperty(prop) || !row[prop])) dataMap.delete(key);

            return dataMap;
        },
        get frameMap() {
            return this.encoding.get("frame").createFrameMap(this.dataMap, this.space);
        },
        get frame() {
            const currentFrame = this.encoding.get("frame").value;
            if (currentFrame == null)
                return this.dataMap;
            else
                return this.frameMap.get(this.encoding.get("frame").value) || new Map();
        },
        get frameData() {
            return [...this.frame.values()];
        },
        get data() {
            if (this.encoding.has("frame")) {
                return [...this.frame.values()];
            }
            return [...this.dataMap.values()];
        }
    }),
    config: config => {
        const obj = {};
        const props = ["space", "important"];
        const typeProps = {
            bubbles: ["trails"]
        }
        if (config.type && typeProps[config.type]) {
            props.push(...typeProps[config.type]);
        }
        props.forEach(prop => {
            if (config[prop]) {
                obj[prop] = config[prop];
            }
        });

        // link encoding properties to encoding models
        if (config.encoding) {
            const encoding = [];
            Object.keys(config.encoding).forEach(key => {
                if (encodingStore.has(key))
                    encoding.push([key, encodingStore.get(key)]);
                else
                    throw ("markerStore config: encodingStore does not have encoding with key: " + key);
            })
            obj.encoding = observable.map(encoding);
        }

        obj.dataSource = dataStore.get(config.dataSource);
        return obj;
    },
    bubbles: () => ({
        important: ["x", "y", "size"],
        trails: {
            show: true,
            start: 1850,
        },
        selected: new Set(["zwe", "swe", "usa"]),
        get frameMap() {
            return this.addTrails(this.encoding.get("frame").createFrameMap(this.dataMap, this.space));
        },
        addTrails: function(frameMap) {
            if (!this.trails.show)
                return frameMap;

            const [minFrame, maxFrame] = d3.extent([...frameMap.keys()]);
            if (!maxFrame)
                return frameMap;

            // for each frame that features in trail, add its markers to frames before it
            // hi -> lo so trailFrames only contain their own markers (no other trails)
            const trailsStart = (minFrame > this.trails.start) ? minFrame : this.trails.start;
            for (let i = maxFrame - 1; i >= trailsStart; i--) {
                const trailFrame = frameMap.get(i);
                for (let markerKey of this.selected) {
                    const markerData = trailFrame.get(markerKey);
                    const newKey = markerKey + '-' + i;
                    const newData = Object.assign({}, markerData, {
                        [Symbol.for('key')]: newKey
                    });
                    for (let j = i + 1; j <= maxFrame; j++) {
                        frameMap
                            .get(j)
                            .set(newKey, newData);
                    }
                }
            }

            return frameMap;
        }

    })
});

markerStore.setMany(markerConfig);

const createObj = (space, row, key) => {
    const obj = {
        [Symbol.for('key')]: key
    };
    space.forEach(dim => obj[dim] = row[dim])
    return obj;
}

const getOrCreateObj = (dataMap, space, row) => {
    let obj;
    const key = createKey(space, row);
    if (!dataMap.has(key)) {
        obj = createObj(space, row, key);
        dataMap.set(key, obj);
    } else {
        obj = dataMap.get(key);
    }
    return obj;
}