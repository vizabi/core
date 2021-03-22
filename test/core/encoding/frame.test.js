import { frame } from '../../../src/core/encoding/frame';
import { baseMarker } from '../../../src/core/marker/baseMarker';
import { dataSourceStore } from '../../../src/core/dataSource/dataSourceStore';
import { _resetGlobalState, configure, autorun } from 'mobx';
import * as DDFCsvReader from 'vizabi-ddfcsv-reader';

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
        const DDFReadObject = DDFCsvReader.getDDFCsvReaderObject();
        dataSourceStore.createAndAddType('ddf', DDFReadObject);
        const mrk = baseMarker({
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
        return multiCheck(mrk, 'dataMap', [
            {
                check: map => {
                    expect(map.get({ 
                        gender: 'male',
                        geo: 'prk'
                    })).toEqual({
                        gender: 'male', geo: 'prk', time: new Date(Date.UTC(1960)),
                        x: 5279170, y: 48.424, frame: new Date(Date.UTC(1960)), 
                        [Symbol.for('key')]: 'gender-male-geo-prk'
                    })
                }
            }, 
            { 
                action: () => mrk.encoding.frame.startPlaying(),
                check: map => expect(map.get({ 
                    gender: 'male',
                    geo: 'prk'
                })).toEqual({
                    gender: 'male', geo: 'prk', time: new Date(Date.UTC(1961)),
                    x: 5403447, y: 48.708, frame: new Date(Date.UTC(1961)),
                    [Symbol.for('key')]: 'gender-male-geo-prk'
                })
            },
            { 
                action: () => mrk.encoding.frame.destruct()
            }
        ])
    })
})