import { baseEncoding } from './baseEncoding';
import { defaultDecorator } from '../utils';

const defaultConfig = {
    modelType: "selection",
    data: {
        filter: {} // force own filter value so it doesn't fall back to marker filter like a normal encoding
    }
}

const functions = {}

export const selection = defaultDecorator({
    base: baseEncoding,
    defaultConfig,
    functions: functions
});