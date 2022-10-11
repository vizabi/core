import { DataFrame } from "../../../src/dataframe/dataFrame";
import { fullJoin } from "../../../src/dataframe/transforms/fulljoin";


describe('dataframe group by + reindex + interpolate', () => {

    const df1 = DataFrame([
            { geo: 'foo', time: new Date(Date.UTC(2000)), pop: 0 },
            { geo: 'foo', time: new Date(Date.UTC(2001)), pop: 1 },
            { geo: 'foo', time: new Date(Date.UTC(2010)), pop: 10  }
        ], ['geo', 'time']);

    const df2 = DataFrame([
            { geo: 'foo', time: new Date(Date.UTC(2000)), pop: 0 },
            { geo: 'foo', time: new Date(Date.UTC(2010)), pop: 10  }
        ], ['geo', 'time']);

    const df3 = DataFrame([
            { geo: 'foo', time: new Date(Date.UTC(2000)), x: new Date(Date.UTC(2000)), pop: 0  },
            { geo: 'foo', time: new Date(Date.UTC(2001)), x: new Date(Date.UTC(2001)), pop: 1  },
            { geo: 'foo', time: new Date(Date.UTC(2010)), x: new Date(Date.UTC(2010)), pop: 10 }
        ], ['geo', 'time']);

    it('basic interpolation case', () => {
        const timekey2005 = (new Date(Date.UTC(2005))).toJSON();

        expect(
            df1.groupBy('time', ['geo'])
                .reindexToKeyDomain("year")
                .interpolateOverMembers({fields: ['pop']})
                .get(timekey2005)
                .get("foo")
                .pop
        ).toEqual(5);
    });


    it('interpolation when only edge values are given', () => {
        const timekey2005 = (new Date(Date.UTC(2005))).toJSON();

        expect(
            df2.groupBy('time', ['geo'])
                .reindexToKeyDomain("year")
                .interpolateOverMembers({fields: ['pop']})
                .get(timekey2005)
                .get("foo")
                .pop
        ).toEqual(5);
    });

    it('interpolation of time itself in one of the measures', () => {
        const timekey2005 = (new Date(Date.UTC(2005))).toJSON();

        expect(
            df3.groupBy('time', ['geo'])
            .reindexToKeyDomain("year")
            .interpolateOverMembers({fields: ["pop"], frameField: "time", frameCopyFields: ["x"]})
            .get(timekey2005)
            .get("foo")
            .x.getUTCFullYear() 
        ).toEqual(2005);
    });
});