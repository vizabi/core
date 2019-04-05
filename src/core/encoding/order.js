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
            const prop = this.marker.getPropForEncoding(this);
            const direction = this.direction;
            return df.order([{ [prop]: direction }]);
        }
    }
});