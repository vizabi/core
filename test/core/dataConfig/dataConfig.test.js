import { dataConfig } from '../../../src/core/dataConfig/dataConfig';
import { marker } from '../../../src/core/marker/marker';
import { dataSourceStore } from '../../../src/core/dataSource/dataSourceStore';
import { _resetGlobalState, autorun, runInAction } from "mobx"
import * as DDFCsvReader from 'vizabi-ddfcsv-reader';

//console.log = jest.fn()

const DDFReadObject = DDFCsvReader.getDDFCsvReaderObject();
dataSourceStore.createAndAddType('ddf', DDFReadObject);

function check(model, propPath) {
    let destruct;
    let promise = new Promise((resolve, reject) => {
        destruct = autorun(() => {
            if (model.state == 'fulfilled') {
                let value = model;
                if (propPath) {
                    for (let step of propPath.split('.')) value = value[step];
                }
                resolve(value);
            }
        });
    });
    return promise.then(resp => (destruct(), resp));
}


function multiCheck(model, propPath, fns) {
    return new Promise((resolve, reject) => {
        let { check, action } = fns.shift();
        const destruct = autorun(() => {
            if (model.state == 'fulfilled') {
                let value = model;
                if (propPath) {
                    for (let step of propPath.split('.')) value = value[step];
                }
                check(value); 
                if (fns.length > 0) {
                    ({ check, action } = fns.shift());
                    runInAction(action);
                } else {
                    destruct();
                    resolve();
                }
            }
        });
    });
}


describe('create stand alone data configs', () => {

    it('create a new dataConfig and get response', () => {
        const data = dataConfig({
            source: {
                values: [{ x: 1, y: 2}, {x: 5, y: 6 }]
            },
            space: [],
            concept: 'x'
        });
        return check(data, 'response').then(response => expect(response.get(1).x).toBe(5));
    })

    it('set a numeric constant', () => {
        const data = dataConfig({
            constant: 6
        });
        return check(data, 'domain').then(domain => expect(domain).toEqual([6,6]));
    })

    it('set a string constant', () => {
        const data = dataConfig({
            constant: 'foo'
        });
        return check(data, 'domain').then(domain => expect(domain).toEqual(['foo']));
    })

    it('create a new dataConfig with 3d space from ddf', () => {
        const data = dataConfig({
            source: { 
                path: 'test/ddf--jheeffer--mdtest',
                modelType: 'ddf'
            },
            concept: 'population_total',
            space: ['geo', 'gender', 'time']
        });
        return check(data, 'response', response => {
            expect(response.get({ geo: 'swe', gender: 'male', time: new Date(Date.UTC(2016)) }).population_total).toBe(4962865)
        });
    })

    it('autoconfigures concept', () => {
        const data = dataConfig({
                source: {
                    values: [{ x: 1, y: 2}, {x: 5, y: 6 }]
                },
                space: [],
                concept: { filter: {
                    concept: { '$eq': 'y' }
                }}
        });
        //data.on('concept', console.log)
        //return new Promise(() => {});
        return check(data, 'response').then(response => expect(response.get(1).y).toBe(6));
    })

    it('autoconfigures space', () => {
        const data = dataConfig({
                source: {
                    values: [{ x: 1, y: 2}, {x: 5, y: 6 }]
                },
                concept: 'x',
                space: { filter: {
                    concept: { '$nin': ['geo','time'] }
                }}
        });
        return check(data, 'response').then(response => expect(response.get(1).x).toBe(5));
    })

    it('autoconfigures concept & space', () => {
        const data = dataConfig({
                source: {
                    values: [{ x: 1, y: 2}, {x: 5, y: 6 }]
                },
                concept: { filter: {
                    concept: { '$eq': 'y' }
                }},
                space: { filter: {
                    concept: { '$nin': ['geo','time'] }
                }}
        });
        return check(data, 'response').then(response => expect(response.get(1).y).toBe(6));
    })

    it('use default space autoconfig', () => {
        const data = dataConfig({
            source: {
                values: [{ x: 1, y: 2}, {x: 5, y: 6 }]
            },
            concept: 'x'
        });
        return check(data, 'response').then(response => expect(response.get(1).x).toBe(5));
    })

    it('use default concept autoconfig', () => {
        const data = dataConfig({
            source: {
                values: [{ x: 1, y: 2}, {x: 5, y: 6 }]
            },
            space: []
        });
        return check(data, 'response').then(response => expect(response.get(1).x).toBe(5));
    })

    it('use default space & concept autoconfig', () => {
        const data = dataConfig({
            source: {
                values: [{ x: 1, y: 2}, {x: 5, y: 6 }]
            }
        });
        return check(data, 'response').then(response => expect(response.get(1).x).toBe(5));
    })

    it('set dataconfig source', () => {
        const data = dataConfig({
            source: {
                values: [{ x: 1, y: 2}, {x: 5, y: 6 }]
            },
            concept: 'x'
        });

        return multiCheck(data, 'response', [
            {
                check: map => expect(map.get(0).x).toBe(1),
            }, 
            { 
                action: () => {
                    data.config.source = {
                        values: [{ x: 3, y: 2}]
                    }
                },
                check: map => expect(map.get(0).x).toBe(3)
            }
        ])
    })


    it('returns spaceCatalog for current source/space', () => {
        const data = dataConfig({
            source: { 
                path: 'test/ddf--jheeffer--mdtest',
                modelType: 'ddf'
            },
            concept: 'population_total',
            space: ['geo', 'gender', 'time']
        });
        return check(data, 'spaceCatalog').then(response => {
            expect(Object.keys(response)).toEqual(data.space)
        });
    })
})


describe('create marker with encoding dataconfigs', () => {
    it('encoding uses marker space', () => {
        const mrk = marker({
            data: {
                space: []
            },
            encoding: {
                x: {
                    data: {
                        source: {
                            values: [{ x: 1, y: 2}, {x: 5, y: 6 }]
                        },
                        concept: 'x'
                    }
                }
            }
        });
        return check(mrk, 'encoding.x.data.response').then(response => expect(response.get(0).x).toBe(1));
    })

    it('encoding uses marker source', () => {
        const mrk = marker({
            data: {
                source: {
                    values: [{ x: 1, y: 2}, {x: 5, y: 6 }]
                },
            },
            encoding: {
                x: {
                    data: {
                        concept: 'x',
                        space: []
                    },
                }
            }
        });
        return check(mrk, 'encoding.x.data.response').then(response => { 
            expect(response.get(0).x).toBe(1)
        });
    })

    it('encoding uses marker space and source', () => {
        const mrk = marker({
            data: {
                source: {
                    values: [{ x: 1, y: 2}, {x: 5, y: 6 }]
                },
                space: []
            },
            encoding: {
                x: {
                    data: {
                        concept: 'x'
                    },
                }
            }
        });
        return check(mrk, 'encoding.x.data.response').then(response => expect(response.get(0).x).toBe(1));
    })


    it('encoding uses autoconfig marker space', () => {
        const mrk = marker({
            data: {
                source: {
                    values: [{ x: 1, y: 2}, {x: 5, y: 6 }]
                },
                space: { 
                    filter: {
                        concept: { '$nin': ['geo','time'] }
                    }
                }
            },
            encoding: {
                x: {
                    data: {
                        concept: 'x'
                    },
                }
            }
        });
        return check(mrk, 'encoding.x.data.response').then(response => {
            expect(response.get(0).x).toBe(1)
        });
    })


    it('encoding uses autoconfig marker space and own autoconfig concept', () => {
        const mrk = marker({
            data: {
                source: {
                    values: [{ x: 1, y: 2}, {x: 5, y: 6 }]
                },
                space: { 
                    filter: {
                        concept: { '$nin': ['geo','time'] }
                    }
                }
            },
            encoding: {
                x: {
                    data: {
                        concept: { filter: {
                            concept: { $eq: 'x' }
                        } }
                    },
                }
            }
        });
        return check(mrk, 'encoding.x.data.response').then(response => {
            expect(response.get(0).x).toBe(1)
        });
    })
}) 