import { promisedComputed } from 'computed-async-mobx'
import { observable } from 'mobx'
import * as d3 from 'd3'

export default window.dataStore = observable.map([
    [
        "gap", {
            file: "basic.csv",
            get data() {
                return promisedComputed([], async() => {
                    return await d3.csv(this.file, d => {
                        for (let key in d) {
                            d[key] = parse(d[key]);
                        }
                        return d;
                    });
                })
            }
        }
    ]
]);

const parse = (val) => +val || val;