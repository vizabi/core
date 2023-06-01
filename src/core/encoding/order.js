import { encoding } from './encoding';
import { resolveRef } from "../config";
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
            return resolveRef(this.config.direction).value || defaults.direction;
        },
        get transformFields() {
            return this.data.isConstant ? [] : [this.name];
        },
        order(df) {
            if (this.data.isConstant)
                return df;
            
            return df.order([{ [this.name]: this.direction }]);
        },
        get transformationFns() {
            return {
                order: this.order.bind(this)
            }
        },
    }
});