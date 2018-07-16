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
                //const dataMapMods = { select: [], filter: [] };
                for (let [prop, encoding] of this.encoding) {
                    //dataMapMods[encoding.modType].push(encoding.mod);
                    if (!this.space.includes(encoding.which)) {
                        encoding._data.forEach(row => {
                            const obj = getOrCreateObj(dataMap, row, this.space);
                            obj[prop] = row[encoding.which];
                        })
                    }
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