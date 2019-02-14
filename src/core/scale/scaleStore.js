import { createStore } from '../genericStore'
import { base } from './base'
import { color } from './color'
import { frame } from './frame'
import { size } from './size'

export const scaleStore = createStore(base, {
    color,
    frame,
    size,
});