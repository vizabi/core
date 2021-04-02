import { DataFrame } from "../../../src/dataframe/dataFrame";
import { extent, extentOfGroupMapKeyPerMarker } from "../../../src/dataframe/info/extent";

const df = DataFrame([
    { time: 2011, geo: 'swe', pop: 5 },
    { time: 2012, geo: 'swe', pop: 3 },
    { time: 2013, geo: 'swe', pop: 6 },
    { time: 2014, geo: 'swe', pop: 2 },
    { time: 2011, geo: 'ger', pop: 4 },
    { time: 2011, geo: 'swe', pop: 8 }
])

const df2 = DataFrame([
    { time: 2011, geo: 'swe', gender: 'male', pop: 3 },
    { time: 2011, geo: 'swe', gender: 'female', pop: 5 },
    { time: 2012, geo: 'swe', gender: 'male', pop: 4 },
    { time: 2012, geo: 'swe', gender: 'female', pop: 12 },
    { time: 2013, geo: 'swe', gender: 'male', pop: 5 },
    { time: 2013, geo: 'swe', gender: 'female', pop: 8 },
    { time: 2015, geo: 'swe', gender: 'male', pop: 6 },
])

const grouped = df.groupBy('time', 'geo');
const grouped2 = df2.groupBy('time', ['geo','gender']);

describe('dataframe extent', () => {

    it('returns standard extent', () => {
        expect(extent(df, 'pop')).toEqual([2, 8])
    });

    it('returns grouped extent', () => {
        expect(extent(df, 'pop', ['geo'])).toEqual({ 
            'geo-ger': [4, 4], 
            'geo-swe': [2, 8] 
        })
    });

    it('returns grouped extent', () => {
        expect(extent(df2, 'pop', ['geo','gender'])).toEqual({ 
            'geo-swe-gender-male': [3, 6],
            'geo-swe-gender-female': [5, 12] 
        })
    });

    it('returns grouped extent with subset', () => {
        expect(extent(df, 'pop', ['geo'], ['geo-ger'])).toEqual({ 
            'geo-ger': [4, 4]
        })
    });

    it('returns grouped extent with subset non-array iterable', () => {
        const map = new Map([['geo-ger', 'foo']]);
        expect(extent(df, 'pop', ['geo'], map.keys())).toEqual({ 
            'geo-ger': [4, 4]
        })
    });

    it('returns standard extent of group', () => {
        expect(extent(grouped, 'pop')).toEqual([2, 8])
    });

    it('returns grouped extent of group', () => {
        expect(extent(grouped, 'pop', ['geo'])).toEqual({ 
            'geo-ger': [4, 4], 
            'geo-swe': [2, 8] 
        })
    });

    it('returns grouped extent of group by key of group', () => {
        expect(extent(grouped, 'pop', ['time'])).toEqual({ 
            'time-2011': [4, 8], 
            'time-2012': [3, 3], 
            'time-2013': [6, 6], 
            'time-2014': [2, 2] 
        })
    });

    it('returns extent of key of group', () => {
        expect(extent(grouped, 'time')).toEqual([2011, 2014])
    });

    it('returns grouped extent of key of grouping by key of group', () => {
        expect(extent(grouped, 'time', ['geo'])).toEqual({ 
            'geo-ger': [2011, 2011], 
            'geo-swe': [2011, 2014] 
        })
    });


    it('returns special case: grouped extent of grouping by key of group', () => {
        expect(extentOfGroupMapKeyPerMarker(grouped, ['geo-ger'], 'time', ['geo'])).toEqual({ 
            'geo-ger': [2011, 2011]
        })
    });

    it('returns special case: grouped extent of grouping by key of group, multidimensional', () => {
        expect(extentOfGroupMapKeyPerMarker(grouped2, ['gender-female-geo-swe'], 'time', ['geo', 'gender'])).toEqual({ 
            'gender-female-geo-swe': [2011, 2013]
        })
    });

    it('returns special case: grouped extent of grouping by key of group, iterator for group subsets', () => {
        const map = new Map([['gender-female-geo-swe', 'foo']])
        expect(extentOfGroupMapKeyPerMarker(grouped2, map.keys(), 'time', ['geo', 'gender'])).toEqual({ 
            'gender-female-geo-swe': [2011, 2013]
        })
    });


});