import { baseEncoding } from './baseEncoding';
import { selection as selFn } from '../selection';
import { defaultDecorator } from '../utils';

const defaultConfig = {
    type: "selection",
    markers: {},
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
    defaultConfig: defaultConfig,
    functions: [functions, selFn()]
});