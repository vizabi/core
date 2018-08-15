import { baseEncoding } from './baseEncoding';
import { defaultDecorator } from '../utils';
import appState from '../appState'

export const x = defaultDecorator({
    base: baseEncoding,
    functions: {
        ordinalScale: "point",
        range() {
            return [0, appState.width]
        }
    }
});