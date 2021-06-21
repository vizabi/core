import { encoding } from './encoding';
import { assign, defaultDecorator, filterObject } from '../utils';
import { DataFrame } from '../../dataframe/dataFrame';
import { pick } from '../../dataframe/dfutils';

const defaultConfig = {
  space: undefined,
  concept: undefined
}

export const aggregate = defaultDecorator({
    base: encoding,
    defaultConfig,
    functions: {
        get grouping () { 
          return this.config.grouping ?? {};
        },
        get measures() {
          return this.config.measures ?? [];
        },
        aggregate(df) {
            const groupSizes = filterObject(this.grouping, 
                (val, key) => df.key.includes(key) && val['grouping'] > 1
            );
            const measures = this.measures;

            if (Object.keys(groupSizes).length == 0) {
              return df;
            }

            let result = DataFrame([], df.key);
            for (const row of df.rows()) {
                // new grouped key
                const newKeyObj = pick(row, df.key);
                for (const dim in groupSizes) {
                    const groupSize = groupSizes[dim]['grouping'];
                    newKeyObj[dim] = Math.floor(+row[dim] / groupSize) * groupSize;
                }
                const keyStr = result.keyFn(newKeyObj);
                // sum if group already exists, otherwise create
                if (result.hasByStr(keyStr)) {
                    const newRow = result.getByStr(keyStr);
                    measures.forEach(measure => newRow[measure] += row[measure])
                } else {
                    const newRow = assign({}, row, newKeyObj);
                    result.setByStr(keyStr, newRow)
                }
            }
        
            return result;
        },
        get transformationFns() {
            return {
                aggregate: this.aggregate.bind(this)
            }
        },
    }
    

});
