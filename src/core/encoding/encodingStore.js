import { createStore } from '../genericStore'
import { encoding } from './encoding'
import { frame } from './frame'
import { selection } from './selection'
import { order } from './order'
import { trail } from './trail'
import { repeat } from './repeat'
import { aggregate } from './aggregate'
import { facet } from './facet'

export const encodingStore = createStore(encoding, {
    frame,
    selection,
    order,
    trail,
    repeat,
    aggregate,
    facet
});