import { encoding } from './encoding';
import { defaultDecorator} from '../utils';

const defaultConfig = {
    data: {}
}

const defaults = {
    wrap: 1
}

export const facet = defaultDecorator({
    base: encoding,
    defaultConfig,
    functions: {
        get wrap() {
            return this.config.wrap || defaults.wrap;
        },
        facet(df) {
            console.log("called transformation in facet enc", df)
            return df;
        },
        get transformationFns() {
            return {
              facet: this.facet.bind(this)
            }
        },
    }
});