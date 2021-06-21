import { createStore } from '../genericStore'
import { scale } from './scale'
import { color } from './color'
import { size } from './size'

export const scaleStore = createStore(scale, {
    color,
    size,
});