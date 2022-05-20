import { DataFrame } from "../../../src/dataframe/dataFrame";
import { filter } from "../../../src/dataframe/transforms/filter";

const df = DataFrame([
    { geo: 'swe', "un_state": true, "is--nordic": true, pop: 5 },
    { geo: 'ger', "un_state": true, "is--nordic": false, pop: 6 }
])

const df2 = DataFrame([
    { geo: 'ger', "un_state": true, "is--nordic": false, pop: 6 }
])

const df3 = DataFrame([
    { geo: 'swe', "un_state": true, "is--nordic": true, pop: 5 }
])

describe('dataframe filter', () => {

    it('filter function on number', () => {
        expect(filter(df, r => r.pop > 5)).toEqual(df2)
    });

    it('filter spec on $gte', () => {
        expect(filter(df, { pop: { $gt: 5 }})).toEqual(df2)
    });

    it('filter spec on $gte', () => {
        expect(filter(df, { pop: { $gte: 6 }})).toEqual(df2)
    });

    it('filter spec on $lt', () => {
        expect(filter(df, { pop: { $lt: 6 }})).toEqual(df3)
    });

    it('filter spec on $lte', () => {
        expect(filter(df, { pop: { $lte: 5 }})).toEqual(df3)
    });

    it('filter spec on $eq shorthand', () => {
        expect(filter(df, { geo: 'ger' })).toEqual(df2)
    });

    it('filter spec on $eq full', () => {
        expect(filter(df, { geo: { $eq: 'ger' } })).toEqual(df2)
    });

    it('filter spec on $ne', () => {
        expect(filter(df, { geo: { $ne: 'swe' } })).toEqual(df2)
    });

    it('filter spec on $in', () => {
        expect(filter(df, { geo: { $in: ['ger','foo'] } })).toEqual(df2)
    });

    it('filter spec on $nin', () => {
        expect(filter(df, { geo: { $nin: ['swe','foo'] } })).toEqual(df2)
    });

    it('filter spec on $not', () => {
        expect(filter(df, { $not: { geo: { $in: ['swe','foo'] } } })).toEqual(df2)
    });

    it('filter spec on $and', () => {
        expect(filter(df, { $and: [
            { geo: 'ger' },
            { pop: 6 }
        ]})).toEqual(df2)
    });

    it('filter spec on $or', () => {
        expect(filter(df, { $or: [
            { geo: 'ger' },
            { pop: 7 }
        ]})).toEqual(df2)
    });

    it('filter spec on $nor', () => {
        expect(filter(df, { $nor: [
            { geo: 'swe' },
            { pop: 5 },
            { pop: 7 }
        ]})).toEqual(df2)
    });

    it('filter spec on property that contains _', () => {
        expect(filter(df, { "un_state": true})).toEqual(df)
    });
    it('filter spec on property that contains --', () => {
        expect(filter(df, { "is--nordic": true})).toEqual(df3)
    });
});