import { createStore } from '../genericStore'
import { base } from './base'
import { color } from './color'
import { size } from './size'

export const scaleStore = createStore(base, {
    color,
    size,
});