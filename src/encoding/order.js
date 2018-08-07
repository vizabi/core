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
        get directions() {
            return this.config.data.map(d => directions[d.direction]);
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
        order(dataMap) {
            const data = Array.from(dataMap);
            const dirs = this.directions;
            data.sort((a, b) => {
                let ao = a[1].order,
                    bo = b[1].order,
                    l = ao.length,
                    sort = 0;

                for (let i = 0; sort == 0 && i < l; i++) {
                    if (dirs[i] == directions.ascending)
                        sort = ao[i] - bo[i];
                    else
                        sort = bo[i] - ao[i];
                }
                return sort;
            });
            return new Map(data);
        },
        processRow(row) {
            const result = [];
            for (let data of this.data) {
                if (data)
                    result.push(row[data.concept])
            }
            return result;
        }
    }
});