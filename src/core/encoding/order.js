import { baseEncoding } from './baseEncoding';
import { defaultDecorator, isString } from '../utils';

const defaultConfig = {};
const directions = {
    ascending: 0,
    descending: 1
}

export const order = defaultDecorator({
    base: baseEncoding,
    defaultConfig,
    functions: {
        get direction() {
            return this.data.config.direction;
        },
        order(dataMap) {
            const prop = this.marker.getPropForEncoding(this);
            const data = Array.from(dataMap);
            const direction = this.direction;
            data.sort((a, b) => {
                let ao = a[1][prop],
                    bo = b[1][prop];

                return direction == directions.ascending ?
                    ao - bo :
                    bo - ao;
            });
            return new Map(data);
        }
    }
});