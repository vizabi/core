import { encoding } from './encoding';
import { defaultDecorator, isString } from '../utils';

const directions = {
    ascending: "ascending",
    descending: "descencding"
}
const defaultConfig = {
    direction: directions.ascending
}

export const order = defaultDecorator({
    defaultConfig,
    base: encoding,
    functions: {
        get direction() {
            return this.config.direction;
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