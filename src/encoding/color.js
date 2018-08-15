import { baseEncoding } from './baseEncoding';
import { defaultDecorator, isString } from '../utils';
//import { schemeCategory10 } from 'd3';

const colors = {
    schemeCategory10: d3.schemeCategory10
}

export const color = defaultDecorator({
    base: baseEncoding,
    defaultConfig: {
        scale: {
            range: null
        }
    },
    functions: {
        range() {
            const range = this.config.range;
            if (isString(range) && colors[range]) {
                return colors[range];
            } else if (Array.isArray(range)) {
                return range;
            }

            return (this.type == "ordinal") ?
                d3.schemeCategory10 : ["red", "green"];
        }
    }
});