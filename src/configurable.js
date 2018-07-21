import { action } from 'mobx'
import { deepmerge } from './utils'

export const configurable = {
    config: {},
    applyConfig: action('applyConfig', function(config) {
        this.config = deepmerge(this.config, config);
        return this;
    })
}