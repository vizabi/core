import { dataConfig } from '../../../src/core/dataConfig/dataConfig';
import { marker } from '../../../src/core/marker/marker';
import { dataSourceStore } from '../../../src/core/dataSource/dataSourceStore';
import { _resetGlobalState, configure, autorun } from "mobx"
import * as DDFCsvReader from 'vizabi-ddfcsv-reader';
import { createConfig } from '../../../src/core/config/config';


function check(model, prop) {
    let destruct;
    let promise = new Promise((resolve, reject) => {
        destruct = autorun(() => {
            if (model.state == 'fulfilled') {
                resolve(model[prop]);
            }
        });
    });
    return promise.then(resp => (destruct(), resp));
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
        const DDFReadObject = DDFCsvReader.getDDFCsvReaderObject();
        dataSourceStore.createAndAddType('ddf', DDFReadObject);
        const data = dataConfig({
            source: { 
                path: 'test/ddf--jheeffer--mdtest',
                modelType: 'ddf'
            },
            concept: 'population_total',
            space: ['geo', 'gender', 'time']
        });
        return check(data, 'responseMap', response => {
            expect(response.get({ geo: 'swe', gender: 'male', time: new Date(Date.UTC(2016)) }).population_total).toBe(4962865)
        });
    })

    it('autoconfigures concept', () => {
        const data = dataConfig({
                source: {
                    values: [{ x: 1, y: 2}, {x: 5, y: 6 }]
                },
                space: [],
                concept: { autoconfig: {
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
                space: { autoconfig: {
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
                concept: { autoconfig: {
                    concept: { '$eq': 'y' }
                }},
                space: { autoconfig: {
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
        return check(mrk.encoding.x.data, 'response').then(response => expect(response.get(0).x).toBe(1));
    })

    it.only('encoding uses marker source', () => {
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
        return check(mrk.encoding.x.data, 'response').then(response => expect(response.get(0).x).toBe(1));
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
        return check(mrk.encoding.x.data, 'response').then(response => expect(response.get(0).x).toBe(1));
    })


    it('encoding uses autoconfig marker space', () => {
        const mrk = marker({
            data: {
                source: {
                    values: [{ x: 1, y: 2}, {x: 5, y: 6 }]
                },
                space: { 
                    autoconfig: {
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
        return check(mrk.encoding.x.data, 'response').then(response => {
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
                    autoconfig: {
                        concept: { '$nin': ['geo','time'] }
                    }
                }
            },
            encoding: {
                x: {
                    data: {
                        concept: { autoconfig: {
                            concept: { $eq: 'x' }
                        } }
                    },
                }
            }
        });
        return check(mrk.encoding.x.data, 'response').then(response => {
            expect(response.get(0).x).toBe(1)
        });
    })
})