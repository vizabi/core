import { baseEncoding } from './baseEncoding';
import { defaultDecorator } from '../utils';
import appState from '../appState'

export const x = defaultDecorator({
    base: baseEncoding,
    functions: {
        get range() {
            return [0, appState.width]
        }
    }
});