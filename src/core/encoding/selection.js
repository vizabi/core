import { encoding } from './encoding';
import { defaultDecorator } from '../utils';

const defaultConfig = {
    data: {
        filter: {} // force own filter value so it doesn't fall back to marker filter like a normal encoding
    }
}

export const selection = defaultDecorator({
    base: encoding,
    defaultConfig
});