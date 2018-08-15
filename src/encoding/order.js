import { baseEncoding } from './baseEncoding';
import { isObservableArray } from 'mobx'
import { defaultDecorator, isString } from '../utils';
import { resolveRef } from '../vizabi'

const defaultConfig = {};
const directions = {
    ascending: 0,
    descending: 1
}

export const order = defaultDecorator({
    base: baseEncoding,
    defaultConfig,
    functions: {
        /*
        get data() {
            var cfgs = this.config.data;
            if (!isObservableArray(cfgs))
                cfgs = [cfgs];

            return cfgs.map(cfg => {
                if (isString(cfg.ref))
                    return resolveRef(cfg);

                return this.createDataProp(cfg);
            }).filter(data => data != null);
        },
        get response() {
            for (let data of this.data) {
                if (data.hasOwnData)
                    return data.response;
            }
        },
        get space() {
            for (let data of this.data) {
                if (data.hasOwnData)
                    return data.space;
            }
        },
        get hasOwnData() {
            return this.data.some(d => d.hasOwnData);
        },
        processRow(row) {
            const result = [];
            for (let data of this.data) {
                if (data)
                    result.push(row[data.concept])
            }
            return result;
        },*/
        get direction() {
            return this.data.config.direction;
        },
        order(dataMap) {
            const data = Array.from(dataMap);
            data.sort((a, b) => {
                let ao = a[1].order,
                    bo = b[1].order;

                return this.direction == directions.ascending ?
                    ao - bo :
                    bo - ao;
            });
            return new Map(data);
        }
    }
});