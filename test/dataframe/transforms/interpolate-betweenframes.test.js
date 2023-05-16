import { DataFrame } from "../../../src/dataframe/dataFrame";


describe('interpolation between the frames', () => {

    const df = DataFrame([
            { geo: 'foo', time: new Date(Date.UTC(2000)), lex: 50, pop: undefined, gdp: 100},
            { geo: 'foo', time: new Date(Date.UTC(2010)), lex: 60, pop: 10, gdp: undefined }
        ], ['geo', 'time'])

        .groupBy('time', ['geo'])
        .reindexToKeyDomain("year")
        .interpolateOverMembers({fields: ['pop', 'gdp', 'lex'], frameField: "time"});
        
    const timekey2000 = (new Date(Date.UTC(2000))).toJSON();
    const timekey2010 = (new Date(Date.UTC(2010))).toJSON();

    const result = df
        .get(timekey2000)
        .interpolateTowards(df.get(timekey2010), 0.1, ['gdp', 'pop', 'lex'])
        .get('foo');


    it('interpolation between frames: regular case', () => {
        expect(result.lex).toEqual(51);
    });

    it('interpolation between frames: first value missing', () => {
        expect(result.pop).toEqual(undefined);
    });

    it('interpolation between frames: second value missing', () => {
        expect(result.gdp).toEqual(undefined);
    });
});