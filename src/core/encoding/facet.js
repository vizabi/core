import { encoding } from './encoding';
import { defaultDecorator} from '../utils';

const defaultConfig = {
    modelType: "facet",
}

const defaults = {
    wrap: 1,
    exceptions: {}
}

export const facet = defaultDecorator({
    base: encoding,
    defaultConfig,
    functions: {
        get wrap() {
            return this.config.wrap || defaults.wrap;
        },
        get exceptions() {
            return new Map(Object.entries(this.config.exceptions || defaults.exceptions));
        },
        supportExceptions(df) {
            //This transformation is created to support exceptions in faceting.
            //For example, we want regions to all go in one facet, but countries to take one facet each:
            //[China], [USA], [Asia, Africa, Europe]
            //This is achieved by adding a "set" entity property in data with values like "country" and "region"
            //and a config for facet enc like so:
            // "facet_row": {
            //   modelType: "facet",
            //   exceptions: {"country": "geo"},
            //   data: {
            //     space: ["geo"],
            //     concept: "set"
            //   }
            // }
            return df.addColumn(this.name, (row) => this.exceptions.has(row[this.name]) 
                ? row[this.exceptions.get(row[this.name])] 
                : row[this.name]);
        },
        get transformationFns() {
            return {
                supportExceptions: this.supportExceptions.bind(this)
            }
        },
    }
});