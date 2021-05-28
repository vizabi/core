import { baseEncoding } from './baseEncoding';
import { defaultDecorator, isString } from '../utils';
import { DataFrame } from '../../dataframe/dataFrame';

const defaults = {
}

export const aggregate = defaultDecorator({
    base: baseEncoding,
    functions: {
        get grouping () { 
          return this.config.grouping || {};
        },
        get measures() {
          return this.config.measures || [];
        },
        aggregate(df) {
            if (Object.keys(this.grouping).every(key => this.grouping[key]["grouping"] === 1)) {
              return df;
            }
        
            const grouping = this.grouping;
            const space = this.parent?.data.space || this.data.space;//query.select.key;
            const measures = [this.name, ...(this.measures ?? [])];//query.select.value.filter(value => conceptProps[value]["concept_type"] === "measure");
      
          
            const groupKeys = Object.keys(grouping || {}).filter(key => 
              space.indexOf(key) !== -1 && grouping[key]["grouping"] > 1);
            
            const groupKeyCalcs = groupKeys.reduce((calcs, key) => (function(group) {
              calcs[key] = function(d) { return ~~(+d / group) * group; };
              return calcs;
            })(grouping[key]["grouping"]), {});

            let nest = d3.nest();

            space.forEach(k => (groupKeyCalc =>
              nest = nest.key(groupKeyCalc ?
                function(d) {
                  return groupKeyCalc(d[k]);
                }
                :
                function(d) {
                  return d[k];
                }
              )
            )(groupKeyCalcs[k]));
      
            if (groupKeys.length) {
              nest = nest.rollup(values => {
                const obj = Object.assign({}, values[0]);
                groupKeys.forEach(key => obj[key] = groupKeyCalcs[key](obj[key]));
                measures.forEach(measure => obj[measure] = d3.sum(values, d => +d[measure]));
                aggrValues.push(obj);
                return 0;
              });
            }
      
            const aggrValues = [];
            nest.entries([...df.rows()]);
            // d3.rollup(df.rows(), values => {
            //   const obj = Object.assign({}, values[0]);
            //   groupKeys.forEach(key => obj[key] = groupKeyCalcs[key](obj[key]));
            //   measures.forEach(measure => obj[measure] = d3.sum(values, d => +d[measure]));
            //   aggrValues.push(obj);
            //   return 0;
            // }, ...space.map(k => (groupKeyCalc => groupKeyCalc ?
            //   function(d) {
            //     return groupKeyCalc(d[k]);
            //   }
            //   :
            //   function(d) {
            //     return d[k];
            //   })(groupKeyCalcs[k]))); 
            const aggrDf = DataFrame(aggrValues, df.key, df.descendantKeys)
            return aggrDf;      
        },
        get transformationFns() {
            return {
                aggregate: this.aggregate.bind(this)
            }
        },
    }
    

});
