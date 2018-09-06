import { x } from './x';
import { y } from './y';
import { color } from './color';
import { size } from './size';
import { frame } from './frame';
import { base } from './base';

export const scales = { frame, x, y, base, size, color }
scales.get = function get(type) {
    if (this[type]) return this[type]
    else return base;
}