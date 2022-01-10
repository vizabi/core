import { autorun } from 'mobx';
import { marker } from '../../../src/core/marker/marker';
import { dataSourceStore } from '../../../src/core/dataSource/dataSourceStore';
import * as DDFCsvReader from '@vizabi/reader-ddfcsv';
import { createKeyFn } from '../../../src/dataframe/dfutils';

const DDFReadObject = DDFCsvReader.getDDFCsvReaderObject();
dataSourceStore.createAndAddType('ddf', DDFReadObject);

function check(model, prop) {
    let destruct;
    let promise = new Promise((resolve, reject) => {
        autorun(() => {
            if (model.state == 'fulfilled') {
                resolve(model[prop]);
            }
        });
    });
    return promise; //.then(resp => (destruct(), resp));
}

function multiCheck(model, prop, fns) {
    return new Promise((resolve, reject) => {
        let { check, action } = fns.shift();
        const destruct = autorun(() => {
            if (model.state == 'fulfilled') {
                check(model[prop]); 
                if (fns.length > 0) {
                    ({ check, action } = fns.shift());
                    action();
                } else {
                    destruct();
                    resolve();
                }
            }
        });
    });
}


describe('create marker', () => {
    it('create a new marker and get dataMap', async () => {
        const mrk = marker({
            data: {   
                source: { 
                    path: 'test/ddf--jheeffer--mdtest',
                    modelType: 'ddf'
                },
                space: ['geo','gender','time']
            },
            encoding: {
                size: { data: { concept: 'population_total' } },
                y: { data: { concept: 'life_expectancy' } },
                x: { data: { 
                    space: ['geo', 'time'],
                    concept: 'income_per_person_gdppercapita_ppp_inflation_adjusted' 
                } },
                label: { data: { 
                    modelType: 'entityPropertyDataConfig',
                    concept: 'name' 
                } }
            }
        })
        const dataMap = await check(mrk, 'dataMap');
        //console.log(dataMap.get({geo: 'swe', gender: 'male', time: new Date(Date.UTC(2012))}));
        const key = {geo: 'swe', gender: 'male', time: new Date(Date.UTC(2012))};
        expect(dataMap.get(key)).toEqual({
            gender: 'male',
            geo: 'swe',
            time: new Date(Date.UTC(2012)),
            size: 4748680,
            y: 79.9,
            x: 43308,
            label: { gender: 'Male', geo: 'Sweden' },
            [Symbol.for('key')]: createKeyFn(dataMap.key)(key)
        })
    })

    it('create a new marker with just dataset and encodings', async () => {

        const mrk = marker({
            data: {   
                source: { 
                    path: 'test/ddf--jheeffer--mdtest',
                    modelType: 'ddf'
                }
            },
            encoding: {
                size: { },
                y: { },
                x: { },
                label: { data: { modelType: 'entityPropertyDataConfig' } },
                frame: { modelType: 'frame' }
            }
        });
        const dataMap = await check(mrk, 'dataMap');
        //console.log(dataMap.get({geo: 'swe', gender: 'male', time: new Date(Date.UTC(2012))}));
        const key = { country: 'swe' };
        expect(dataMap.get(key)).toEqual({
            country: 'swe',
            frame: new Date(Date.UTC(2018)),
            time: new Date(Date.UTC(2018)),
            size: 47520,
            y: null,
            x: null,
            label: { country: 'Sweden' },
            [Symbol.for('key')]: createKeyFn(dataMap.key)(key)
        })
    })
})