import { baseEncoding } from './baseEncoding';
import { defaultDecorator } from '../utils';

export const size = defaultDecorator({
    base: baseEncoding,
    defaultConfig: {
        range: [0, 20],
        scale: "sqrt"
    }
});