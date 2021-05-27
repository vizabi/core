import { baseEncoding } from './baseEncoding';
import { defaultDecorator } from '../utils';

const defaultConfig = {
    modelType: "selection",
    data: {
        concept: undefined,
        space: undefined
    }
}

export const selection = defaultDecorator({
    base: baseEncoding,
    defaultConfig
});