import encodingStore from './encodingStore'
import { observable } from 'mobx'

export default window.markerStore = observable.map([
    [
        "bubbles", observable({
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
                const dataMapMods = { select: [], filter: [] };
                for (let [prop, encoding] of this.encoding) {
                    //dataMapMods[encoding.modType].push(encoding.mod);
                    if (!this.space.includes(encoding.which)) {
                        encoding.data.forEach(row => {
                            const obj = getOrCreateObj(dataMap, row, this.space);
                            obj[prop] = row[encoding.which];
                        })
                    }
                }
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

const createKey = (space, row) => space.map(dim => row[dim]).join('-');
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