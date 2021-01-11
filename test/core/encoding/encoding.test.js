import { autorun } from 'mobx';
import { encoding } from '../../../src/core/encoding/encoding';

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

describe('tests', () => {
    it('create a new encoding and use setwhich', () => {
        const enc = encoding({
            data: {
                source: {
                    values: [{ x: 1, y: 2}, {x: 5, y: 6 }]
                },
                concept: 'x',
                space: []
            }
        });
        return multiCheck(enc.data, 'responseMap', [
            {
                check: map => expect(map.get(0).x).toBe(1),
            }, 
            { 
                action: () => enc.setWhich({ key: [], value: 'y' }),
                check: map => expect(map.get(0).y).toBe(2)
            }
        ])
    })
})