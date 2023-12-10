import { encoding } from './encoding';
import { assign, combineStates, defaultDecorator, getConceptsCatalog } from '../utils';
import { fromPromise } from 'mobx-utils';
import { DataFrameGroup } from '../../dataframe/dataFrameGroup';
import { DataFrame } from '../../dataframe/dataFrame';

const defaults = {
}

const PADDING_RATIO = 0.1;
const unique = (array, accessor) => [...new Set(array.map(accessor))];

let trackLookup;

export const lane = defaultDecorator({
    base: encoding,
    functions: {
        get transformFields() {
            return this.data.isConstant ? [] : [this.name];
        },

        get firstDim() {
            return this.data.space[0];
        },

        lookupID(d) {
            const frameConcept = this.marker.encoding.frame.data.concept;
            return d[this.firstDim] + (this.data.space.includes(frameConcept) ? d[frameConcept].toISOString() : "");
        },

        get rollup() {
            const concept = this.data.concept;
            trackLookup = new Map();

            let total = 0;
            let runningTotal = 0;
            
            const addTrackValue = d => {
                trackLookup.set(this.lookupID(d), d.track)
            }
            
            const rollup = d3.rollups(
              this.data.response,
              (a) => {
                const array = a.map(([k, v]) => v);
      
                const isDefined = !!array[0][concept];
                const items = isDefined ? unique(array, (d) => d[this.firstDim]) : [];
                total += items.length;
                return {          
                  items,
                  values: array.map((d) => ({ track: isDefined? items.indexOf(d[this.firstDim]) : 0, ...d }))
                };
      
              },
              ([k, v]) => v[this.data.concept]
            )
            .sort(([a], [b]) => this.comparator(a,b))
            .filter(([k])=>!!k)
            .map(([k,v]) => {
              v.values.forEach(d => d.track += runningTotal); 
              v.values.forEach(d => addTrackValue(d)); 
              const runningTotal_1 = runningTotal;
              const tickPosition = runningTotal_1 - Math.round(total * PADDING_RATIO / 2);
              runningTotal += v.items.length + Math.round(total * PADDING_RATIO);
        
              return {id: k, name: this.conceptEntities.get(k)?.name, min: runningTotal_1, max: runningTotal, tickPosition};
            });
      
            return rollup;
        },

        get totalTrackNumber() {
            return this.rollup.at(-1)?.max;
        },

        comparator(a, b) {
            return !a ? -1 : d3.ascending(this.conceptEntities.get(a)?.rank, this.conceptEntities.get(b)?.rank);
        },

        get placeholderEntities() {
            const entities = unique([...this.data.response.values()], d => d[this.data.concept]).filter(f => !!f);
            return new Map(entities.map(m => ([m, {name: m, rank: +m.replace(/\D/g,'')}])));
        },

        get conceptCatalogPromise() {
            return fromPromise(getConceptsCatalog([this.data.concept], this.data, 1))
        },

        get conceptEntities() {
            const empty = new Map();
            return this.conceptCatalogPromise.case({
                fulfilled: v => v[this.data.concept].entities || this.placeholderEntities,
                pending: () => empty,
                rejected: (e) => empty
            })
        },

        addTrack(df) {
            if (this.config.scale.type !== "rank" || this.data.isConstant || !this.conceptEntities.size)
                return df;
            this.rollup;
            const _df = DataFrameGroup([], df.key, df.descendantKeys);
            
            for (const [frame, dataSlice] of df){
                const keyObj = df.keyObject(dataSlice);
                const newDataSlice = DataFrame([], dataSlice.key);
                for (const [key, row] of dataSlice) {
                    const newRow = assign({}, row);
                    newRow[this.data.concept] = row[this.name];
                    newRow[this.name] = trackLookup.get(this.lookupID(row));
                    newDataSlice.set(newRow, key);
                }
                _df.set(keyObj, newDataSlice);
            }
            return _df;
        },

        get state() {
            return combineStates(this.config.scale.type !== "rank" ? 
                [this.data.state, this.referenceState]
                :
                [this.data.state, this.referenceState, this.conceptCatalogPromise.state]
            );
        },

        get transformationFns() {
            return {
                addTrack: this.addTrack.bind(this)
            }
        },
    }
});