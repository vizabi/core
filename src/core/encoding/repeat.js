import { baseEncoding } from './baseEncoding';
import { defaultDecorator } from '../utils';

export const repeat = defaultDecorator({
    base: baseEncoding,
    functions: {
        get row() {
            return this.config.row;
        },
        get column() {
            return this.config.column;
        }
    }
});