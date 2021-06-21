import { encoding } from './encoding';
import { defaultDecorator } from '../utils';

const defaultConfig = {
    modelType: "selection",
    data: {
        concept: undefined,
        space: undefined
    }
}

export const selection = defaultDecorator({
    base: encoding,
    defaultConfig
});