import { baseEncoding } from './baseEncoding';
import { defaultDecorator, isString } from '../utils';
import { labelDataConfig } from '../dataConfig/labelDataConfig';
import { resolveRef } from '../vizabi';
import { observable } from 'mobx';


export const label = defaultDecorator({
    base: baseEncoding,
    functions: {
        get data() {
            var cfg = resolveRef(this.config.data);

            return observable(labelDataConfig(cfg, this));
        },
        addPropertyToMarkers(dataMap, prop) {
            this.data.addLabels(dataMap, prop);
        }
    }
});