import { baseEncoding } from './baseEncoding';
import { defaultDecorator, isString } from '../utils';

const defaultConfig = {};
const directions = {
    ascending: "ascending",
    descending: "descencding"
}

export const order = defaultDecorator({
    base: baseEncoding,
    defaultConfig,
    functions: {
        get direction() {
            return this.data.config.direction || directions.ascending;
        },
        order(df) {
            const prop = this.marker.getPropForEncoding(this);
            const direction = this.direction;
            return df.order([{ [prop]: direction }]);
        }
    }
});