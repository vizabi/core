import { baseEncoding } from './baseEncoding';
import { defaultDecorator, isString } from '../utils';
import { labelDataConfig } from '../dataConfig/labelDataConfig';
import { resolveRef } from '../vizabi';
import { observable } from 'mobx';

export const label = defaultDecorator({
    base: baseEncoding,
    functions: {
        get data() {
            var cfg = this.config.data;
            if (isString(cfg.ref))
                return resolveRef(cfg);

            return observable(labelDataConfig(cfg, this));
        }
    }
});