import { createStore } from '../genericStore'
import { baseScale } from './baseScale'
import { color } from './color'
import { size } from './size'

export const scaleStore = createStore(baseScale, {
    color,
    size,
});