import encodingStore from './encodingStore'
import { observable } from 'mobx'
import { createKey } from './utils'

export default window.markerStore = observable.map([
    [
        "bubbles", observable({
            important: ["x", "y", "size"],
            space: ["geo", "time"],
            encoding: observable.map([
                [
                    "size", encodingStore.get("size")
                ],
                [
                    "x", encodingStore.get("x")
                ],
                [
                    "y", encodingStore.get("y")
                ],
                [
                    "color", encodingStore.get("color")
                ],
                [
                    "frame", encodingStore.get("frame")
                ]
            ]),
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
                        const obj = getOrCreateObj(dataMap, row, this.space);
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
                return this.frameMap.get(this.encoding.get("frame").value) || new Map();
            },
            get frameData() {
                return [...this.frame.values()]
            },
            get data() {
                return [...this.dataMap.values()]
            }
        })
    ]
]);

const createObj = (space, row) => {
    const obj = {}
    space.forEach(dim => {
        obj[dim] = row[dim]
    })
    return obj
}
const getOrCreateObj = (map, row, space) => {
    const key = createKey(space, row);
    if (!map.has(key)) {
        const obj = createObj(space, row);
        obj[Symbol.for('key')] = key;
        map.set(key, obj);
        return obj;
    }
    return map.get(key);
}