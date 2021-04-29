import { autorun } from 'mobx';
import { baseEncoding } from '../../../src/core/encoding/baseEncoding';
import { baseMarker } from '../../../src/core/marker/baseMarker';

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
                    action();
                } else {
                    destruct();
                    resolve();
                }
            }
        });
    });
}

describe('tests', () => {
    it('create a new encoding and use setwhich', () => {
        const enc = baseEncoding({
            data: {
                source: {
                    values: [{ x: 1, y: 2}, {x: 5, y: 6 }]
                },
                concept: 'x',
                space: []
            }
        });
        return multiCheck(enc, 'data.response', [
            {
                check: map => expect(map.get(0).x).toBe(1),
            }, 
            { 
                action: () => enc.setWhich({ key: [], value: 'y' }),
                check: map => expect(map.get(0).y).toBe(2)
            }
        ])
    })

    it('change marker datasource on the fly', () => {
        const marker = baseMarker({
            data: {
                source: {
                    values: [{ x: 1, y: 2}, {x: 5, y: 6 }]
                },
            },
            encoding: {
                x:  {
                    data: {
                        concept: 'x',
                        space: []
                    }
                }
            }
        });

        return multiCheck(marker, 'encoding.x.data.response', [
            {
                check: map => expect(map.get(0).x).toBe(1),
            }, 
            { 
                action: () => {
                    marker.config.data.source = {
                        values: [{ x: 3, y: 2}]
                    }
                },
                check: map => expect(map.get(0).x).toBe(3)
            }
        ])
    })


    it('change from marker datasource to encoding datasource through setWhich', () => {
        const marker = baseMarker({
            data: {
                source: {
                    values: [{ x: 1, y: 2}, {x: 5, y: 6 }]
                },
            },
            encoding: {
                x:  {
                    data: {
                        concept: 'x',
                        space: []
                    }
                }
            }
        });

        return multiCheck(marker, 'encoding.x.data.response', [
            {
                check: map => expect(map.get(0).x).toBe(1),
            }, 
            { 
                action: () => {
                    marker.encoding.x.setWhich({
                        value: {
                            dataSource: {
                                values: [{ x: 3, y: 2}]
                            },
                            concept: 'x'
                        },
                        key: []
                    })
                },
                check: map => expect(map.get(0).x).toBe(3)
            }
        ])
    })
})