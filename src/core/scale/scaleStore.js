import { createStore } from '../genericStore'
import { scale } from './scale'
import { color } from './color'
import { size } from './size'
import { rank } from './rank'

export const scaleStore = createStore(scale, {
    color,
    size,
    rank
});