import { encoding } from './encoding';
import { resolveRef } from "../config";
import { defaultDecorator, isString } from '../utils';

const directions = {
    ascending: "ascending",
    descending: "descencding"
}
const defaults = {
    direction: directions.ascending,
    custom: []
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
            
            if (this.custom?.length)
                return df.order( new Map([[this.name, this.custom]]) );

            return df.order([{ [this.name]: this.direction }]);
        },
        get custom() {
            return resolveRef(this.config.custom).value || defaults.custom;
        },
        get transformationFns() {
            return {
                order: this.order.bind(this)
            }
        },
    }
});