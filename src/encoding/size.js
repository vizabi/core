import { baseEncoding } from './baseEncoding';
import { defaultDecorator } from '../utils';

export const size = defaultDecorator({
    base: baseEncoding,
    defaultConfig: {
        scale: {
            type: "sqrt",
            range: [0, 20]
        }
    },
    functions: {
        ordinalScale: "point",
        range() {
            if (this.config.range != null)
                return this.config.range
            if (this.type == "point")
                return [1, 20];
            return [0, 20];
        }
    }
});