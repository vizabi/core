import { encoding } from './encoding';
import { defaultDecorator } from '../utils';

const defaultConfig = {
    data: {
        concept: undefined,
        space: undefined
    }
}

const defaults = {
    ncolumns: 1
}

export const repeat = defaultDecorator({
    base: encoding,
    defaultConfig,
    functions: {
        //["y1", "y2"], this is for special case when aliases are connected across rows-columns 
        get row() {
            return this.config.row;
        },
        //["x1", "x2"], this is for special case when aliases are connected across rows-columns 
        get column() {
            return this.config.column;
        },
        //["x", "y"], this is the blueprint that indicates which encodings need to be aliased
        //must be of length 2 for "row" and "column" to work
        get allowEnc() {
            if(!this.config.allowEnc) console.warn(`Repeater encoding is missine essential bit of config "allowEnc"`)
            return this.config.allowEnc;
        },
        //{x: x, y: y}, unfolds enc array of strings into an object
        get guessAliases() {
            return this.allowEnc.reduce((obj, value) => {
                if (!this.marker.encoding[value]) value = this.marker.requiredEncodings.at(-1);
                obj[value] = value;
                return obj;
            }, {})
        },
        get useConnectedRowsAndColumns(){
          return !!this.config.useConnectedRowsAndColumns;
        },
        //[{x: x1, y: y1}, {x: x2, y: y1}]
        get rowcolumn() {
            if(this.config.rowcolumn) return this.config.rowcolumn;
            
            if(this.useConnectedRowsAndColumns){
                //flatten row and column arrays into rowcolumn
                const {allowEnc, row, column} = this;
                const rowcolumn = [];
                row.forEach(r => {
                    column.forEach(c => {
                        rowcolumn.push({[allowEnc[0]]: r, [allowEnc[1]]: c});
                    });
                });
                return rowcolumn;
            } else {
                //try to guess aliases as defaults
                return [this.guessAliases];
            }
        },
        //1, generic way: number of columns for wrapping
        get ncolumns() {
            return this.config.ncolumns || this.useConnectedRowsAndColumns && this.column.length || defaults.ncolumns;
        },
        get nrows() {
            return this.rowcolumn.length / this.ncolumns;
        },
        getName: function(d) {
            const hash = Object.keys(d)
                .sort(d3.ascending)
                .map(key => key + "-" + d[key])
                .join("--");
            return `chart-repeated--${hash}`;
        },
        getRowIndex: function(i) {
            return Math.floor(i/this.ncolumns);
        },
        getColumnIndex: function(i) {
            return i % this.ncolumns;
        },
    }
});