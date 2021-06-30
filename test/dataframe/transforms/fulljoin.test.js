import { DataFrame } from "../../../src/dataframe/dataFrame";
import { fullJoin } from "../../../src/dataframe/transforms/fulljoin";


describe('dataframe full join keyed df', () => {

    const df = DataFrame([
        { geo: 'swe', pop: 5 },
        { geo: 'ger', pop: 6 }
    ], ['geo'])
    
    const df2 = DataFrame([
        { geo: 'ger', lex: 6 },
        { geo: 'ukr', lex: 10 }
    ], ['geo'])
    
    const result1 = DataFrame([
        { geo: 'ger', pop: 6, lex: 6 },
        { geo: 'swe', pop: 5, lex: undefined },
        { geo: 'ukr', pop: undefined, lex: 10 }
    ], ['geo'])
    
    const result2 = DataFrame([
        { geo: 'ger', size: 6, order: 6, y: 6 },
        { geo: 'swe', size: 5, order: 5, y: undefined },
        { geo: 'ukr', size: undefined, order: undefined, y: 10 }
    ], ['geo'])

    const result3 = DataFrame([
        { geo: 'ger', size: 6, order: 6, y: 6, x: 6 },
        { geo: 'swe', size: 5, order: 5, y: 5, x: 5 },
    ], ['geo'])

    it('two dfs passed as array', () => {
        expect(fullJoin([df, df2])).toEqual(result1);
    });

    it('all fields are explicitly included, even if undefined', () => {
        const joined = fullJoin([df, df2]);
        const swe = joined.get('swe');
        const ukr = joined.get('ukr');
        expect(swe).toHaveProperty('lex');
        expect(swe.lex).toBeUndefined();
        expect(ukr).toHaveProperty('pop');
        expect(ukr.pop).toBeUndefined();
    });

    it('two dfs as df method', () => {
        expect(df.fullJoin([df2])).toEqual(result1)
    });

    it('two dfs as df method, passing explicit key', () => {
        expect(df.fullJoin([df2], ['geo'])).toEqual(result1)
    });

    it('two dfs with projection as either array or string', () => {
        expect(fullJoin([{
            dataFrame: df,
            projection: { 'pop': ['size', 'order'] }
        }, {
            dataFrame: df2,
            projection: { 'lex': 'y' }
        }])).toEqual(result2)
    });

    it('two params with same df but different projection', () => {
        expect(fullJoin([{
            dataFrame: df,
            projection: { 'pop': ['size', 'order'] }
        }, {
            dataFrame: df,
            projection: { 'pop': ['y', 'x'] }
        }])).toEqual(result3)
    });

});


describe('dataframe full join with different keys', () => {

    const df = DataFrame([
        { geo: 'swe', pop: 5 },
        { geo: 'ger', pop: 6 }
    ])

    const df2 = DataFrame([
        { geo: 'ger', lex: 6 },
        { geo: 'ukr', lex: 10 }
    ])
    
    const df3 = DataFrame([
        { geo: 'ger', pop: 6, lex: 6 },
        { geo: 'swe', pop: 5, lex: undefined },
        { geo: 'ukr', pop: undefined, lex: 10 }
    ], ['geo'])

    it('two 0d dfs passed as array, with given join key', () => {
        expect(fullJoin([df, df2], ['geo'])).toEqual(df3);
    });

    const df_1d = DataFrame([
        { geo: 'ger', lex: 6 },
        { geo: 'ukr', lex: 10 }
    ], ['geo'])

    const df_2d = DataFrame([
        { geo: 'swe', year: 2010, pop: 5 },
        { geo: 'ger', year: 2010, pop: 6 }
    ], ['geo','year'])

    const df_1d_result = DataFrame([
        { geo: 'swe', pop: 5, lex: undefined },
        { geo: 'ger', pop: 6, lex: 6 },
        { geo: 'ukr', pop: undefined, lex: 10 }
    ], ['geo'])

    it('one 1d and one 2d passed as array, joinkey defaulting to first df key', () => {
        expect(fullJoin([df_1d, df_2d])).toEqual(df_1d_result);
    });

    it('one 1d and one 2d passed as array with given join key', () => {
        expect(fullJoin([df_2d, df_1d], ['geo'])).toEqual(df_1d_result);
    });

});