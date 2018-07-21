import { baseEncoding } from './baseEncoding';
import { defaultDecorator } from '../utils';
import appState from '../appState'

export const y = defaultDecorator({
    base: baseEncoding,
    functions: {
        get range() {
            return [appState.height, 0]
        }
    }
});