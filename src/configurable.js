import { action } from 'mobx'
import { deepmerge } from './utils'

export const configurable = {
    applyConfig: action('applyConfig', function(config) {
        this.config = deepmerge(this.config, config);
        return this;
    })
}