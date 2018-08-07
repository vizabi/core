import { baseEncoding } from './baseEncoding';
import { defaultDecorator } from '../utils';

export const size = defaultDecorator({
    base: baseEncoding,
    defaultConfig: {
        scale: {
            type: "sqrt",
            range: [0, 20]
        }
    }
});