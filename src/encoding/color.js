import { baseEncoding } from './baseEncoding';
import { defaultDecorator, isString } from '../utils';
import { schemeCategory10 } from 'd3';
import { configurable } from '../configurable';

const colors = { schemeCategory10 }

export const color = defaultDecorator({
    base: baseEncoding,
    defaultConfig: {
        scale: {
            range: "schemeCategory10"
        }
    },
    functions: {
        range() {
            const range = this.config.scale.range;
            if (isString(range) && colors[range]) {
                return colors[range];
            } else if (Array.isArray(range)) {
                return range;
            }
            return schemeCategory10;
        }
    }
});