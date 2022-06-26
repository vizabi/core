import { autorun } from 'mobx';
import { marker } from '../../../src/core/marker/marker';
import { dataSourceStore } from '../../../src/core/dataSource/dataSourceStore';
import * as DDFCsvReader from '@vizabi/reader-ddfcsv';

const DDFReadObject = DDFCsvReader.getDDFCsvReaderObject();
dataSourceStore.createAndAddType('ddf', DDFReadObject);

const destruct = [];

function check(model, prop) {
    //let destruct;
    let promise = new Promise((resolve, reject) => {
        destruct.push(autorun(() => {
            if (model.state == 'fulfilled') {
                resolve(model[prop]);
            }
        }));
    });
    return promise; //.then(resp => (destruct(), resp));
}

const mrk = marker({
    data: {   
        source: { 
            path: 'test/ddf--jheeffer--mdtest',
            modelType: 'ddf'
        }
    },
    encoding: {
        frame: { modelType: 'frame' }
    }
});


//.drilldown({dim: "geo", entity: "asia"}) // =>{country: ["chn", "ind", "idn" ..... ]}
//.drilldown({dim: "geo", entity: "usa"}) // => null
//.drilldown({dim: "geo", entity: ["landlocked"]}) // => {country: ["afg", "rwa",  .... ]}
//.drilldown({dim: "geo", entity: ["usa", "landlocked"]}) // => {country: ["afg", "rwa",  .... ]} (same)
//.drilldown({dim: "geo", entity: ["asia", "landlocked"]}) // => {country:  [chn", "ind", "afg", "rwa",  .... ] } 


describe('test drilldown', () => {
    it('test drilldown for one drilldown entity', async () => {
        const data = await check(mrk, "data");
        const drilldown = await data.source.drilldown({dim: "geo", entity: "asia"});
        
        expect(drilldown.country.length).toEqual(80);
    });
    it('test drilldown for non drilldown entity', async () => {
        const data = await check(mrk, "data");
        const drilldown = await data.source.drilldown({dim: "geo", entity: "usa"});
        
        expect(drilldown).toEqual(null);
    });
    it('test drilldown for one entity in array', async () => {
        const data = await check(mrk, "data");
        const drilldown = await data.source.drilldown({dim: "geo", entity: ["landlocked"]});

        expect(drilldown.country.length).toEqual(47);
    });
    it('test drilldown for entities in array (one is not drilldown)', async () => {
        const data = await check(mrk, "data");
        const drilldown = await data.source.drilldown({dim: "geo", entity: ["usa", "landlocked"]});

        expect(drilldown.country.length).toEqual(47);
    });
    it('test drilldown for entities in array', async () => {
        const data = await check(mrk, "data")
        
        const drilldownLandlocked = await data.source.drilldown({dim: "geo", entity: ["landlocked"]});
        const drilldownUsaLandlocked = await data.source.drilldown({dim: "geo", entity: ["usa", "landlocked"]});
        const drilldownAsia = await data.source.drilldown({dim: "geo", entity: ["asia"]});
        const drilldownAsiaLandlocked = await data.source.drilldown({dim: "geo", entity: ["asia", "landlocked"]});
        
        const uniqueAsiaLandlockedEntities = [...new Set([...drilldownLandlocked.country, ...drilldownAsia.country])].sort();
        
        expect(drilldownLandlocked).toEqual(drilldownUsaLandlocked);
        expect(drilldownAsiaLandlocked.country).toEqual(uniqueAsiaLandlockedEntities);
    });
});

describe('test drillup', () => {
    it('test drillup for usa', async () => {
        const data = await check(mrk, "data")
        const drillup = await data.source.drillup({dim: "geo", entity: "usa"})

        expect(drillup).toEqual({
            world_4region: 'americas',
            world_6region: 'america',
            g77_and_oecd_countries: 'oecd',
            income_groups: 'high_income',
            landlocked: 'coastline',
            main_religion_2008: 'christian',
        });
    });
    it('test drillup for abkh', async () => {
        const data = await check(mrk, "data")
        const drillup = await data.source.drillup({dim: "geo", entity: "abkh"})

        expect(drillup).toEqual({
            g77_and_oecd_countries: 'others',
            income_groups: '',
            landlocked: '',
            main_religion_2008: '',
            world_4region: 'europe',
            world_6region: 'europe_central_asia'
        });
    });
});

afterAll(() => {
    destruct.forEach(d => d())
});