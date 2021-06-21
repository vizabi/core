import { encoding } from './encoding';
import { defaultDecorator, isString } from '../utils';

const directions = {
    ascending: "ascending",
    descending: "descencding"
}
const defaults = {
    direction: directions.ascending
}

export const order = defaultDecorator({
    base: encoding,
    functions: {
        get direction() {
            return this.config.direction || defaults.direction;
        },
        get transformFields() {
            return this.data.isConstant ? [] : [this.name];
        },
        order(df) {
            if (this.data.isConstant)
                return df;
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