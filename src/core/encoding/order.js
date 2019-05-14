import { baseEncoding } from './baseEncoding';
import { defaultDecorator, isString } from '../utils';

const directions = {
    ascending: "ascending",
    descending: "descencding"
}
const defaults = {
    direction: directions.ascending
}

export const order = defaultDecorator({
    base: baseEncoding,
    functions: {
        get direction() {
            return this.data.config.direction || defaults.direction;
        },
        order(df) {
            const name = this.name;
            const direction = this.direction;
            return df.order([{ [name]: direction }]);
        },
        get transformationFns() {
            return {
                order: this.order.bind(this)
            }
        },
    }
});