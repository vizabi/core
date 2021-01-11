import { createStore } from '../genericStore'
import { encoding } from './encoding'
import { frame } from './frame'
import { selection } from './selection'
import { order } from './order'
import { trail } from './trail'

export const encodingStore = createStore(encoding, {
    frame,
    selection,
    order,
    trail
});