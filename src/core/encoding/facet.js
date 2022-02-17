import { encoding } from './encoding';
import { assign, defaultDecorator, filterObject } from '../utils';
import { DataFrame } from '../../dataframe/dataFrame';
import { pick } from '../../dataframe/dfutils';

const defaultConfig = {
    data: {
        concept: undefined,
        space: undefined
    }
}

const defaults = {
    ncolumns: 1
}

export const facet = defaultDecorator({
    base: encoding,
    defaultConfig,
    functions: {
        //"geo"
        get row() {
            return this.config.row;
        },
        //"gender"
        get column() {
            return this.config.column;
        },
        //1, generic way: number of columns for wrapping
        get ncolumns() {
            return this.config.ncolumns || defaults.ncolumns;
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