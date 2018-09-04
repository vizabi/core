import { baseEncoding } from './baseEncoding';
import { defaultDecorator } from '../utils';

const defaultConfig = {
    type: "selection",
    data: {
        filter: {} // force own filter value so it doesn't fall back to marker filter like a normal encoding
    }
}

const functions = {
    // selections don't have their own data (yet)
    // possibly they take dataMap and add 'selected/highlighted' boolean properties
    get response() {
        return [];
    }
}

export const selection = defaultDecorator({
    base: baseEncoding,
    defaultConfig,
    functions: functions
});