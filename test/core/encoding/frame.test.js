import { marker } from '../../../src/core/marker/marker';
import { dataSourceStore } from '../../../src/core/dataSource/dataSourceStore';
import { _resetGlobalState, configure, autorun } from 'mobx';
import * as DDFCsvReader from '@vizabi/reader-ddfcsv';
import { createKeyFn } from '../../../src/dataframe/dfutils';

const DDFReadObject = DDFCsvReader.getDDFCsvReaderObject();
dataSourceStore.createAndAddType('ddf', DDFReadObject);

function multiCheck(model, propPath, fns) {
    return new Promise((resolve, reject) => {
        let { check, action } = fns.shift();
        const destruct = autorun(() => {
            if (model.state == 'fulfilled') {
                let value = model;
                for (let step of propPath.split('.')) value = value[step];
                check(value); 
                if (fns.length > 0) {
                    ({ check, action } = fns.shift());
                    if (action) action();
                } 
                if (fns.length == 0 && !check) {
                    destruct();
                    resolve();
                }
            }
        });
    });
}

describe('frame encoding', () => {
    it('marker with frame and play', () => {
        const mrk = marker({
            data: {
                source: {
                    path: 'test/ddf--jheeffer--mdtest',
                    modelType: 'ddf'
                },
                space: ['geo','gender','time']
            },
            encoding: {
                x: { data: { concept: 'population_total' } },
                y: { data: { concept: 'life_expectancy' } },
                frame: { 
                    modelType: 'frame',
                    data: { concept: 'time' }
                }
            }
        })
        const key = { 
            gender: 'male',
            geo: 'prk'
        }
        return multiCheck(mrk, 'dataMap', [
            {
                check: map => {
                    expect(map.get(key)).toEqual({
                        gender: 'male', geo: 'prk', time: new Date(Date.UTC(2016)),
                        x: 12407156, y: 68.055, frame: new Date(Date.UTC(2016)), 
                        [Symbol.for('key')]: createKeyFn(map.key)(key)
                    })
                }
            }, 
            { 
                action: () => mrk.encoding.frame.startPlaying(),
                check: map => expect(map.get(key)).toEqual({
                    gender: 'male', geo: 'prk', time: new Date(Date.UTC(1960)),
                    x: 5279170, y: 48.424, frame: new Date(Date.UTC(1960)),
                    [Symbol.for('key')]: createKeyFn(map.key)(key)
                })
            },
            { 
                action: () => mrk.encoding.frame.dispose()
            }
        ])
    })


    it('default autoconfig frame to time concept in space', () => {
        const mrk = marker({
            data: {
                source: {
                    path: 'test/ddf--jheeffer--mdtest',
                    modelType: 'ddf'
                },
                space: ['geo','gender','time']
            },
            encoding: {
                x: { data: { concept: 'population_total' } },
                y: { data: { concept: 'life_expectancy' } },
                frame: { 
                    modelType: 'frame'
                }
            }
        })
        const key = { 
            gender: 'male',
            geo: 'prk'
        };
        return multiCheck(mrk, 'dataMap', [
            {
                check: map => {
                    expect(map.get(key)).toEqual({
                        gender: 'male', geo: 'prk', time: new Date(Date.UTC(2016)),
                        x: 12407156, y: 68.055, frame: new Date(Date.UTC(2016)), 
                        [Symbol.for('key')]: createKeyFn(map.key)(key)
                    })
                }
            }, 
            { 
                action: () => mrk.encoding.frame.startPlaying(),
                check: map => {
                    expect(map.get(key)).toEqual({
                        gender: 'male', geo: 'prk', time: new Date(Date.UTC(1960)),
                        x: 5279170, y: 48.424, frame: new Date(Date.UTC(1960)),
                        [Symbol.for('key')]: createKeyFn(map.key)(key)
                    })
                }
            },
            { 
                action: () => mrk.encoding.frame.dispose()
            }
        ])
    })
})