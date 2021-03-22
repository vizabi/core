import { autorun } from 'mobx';
import { baseEncoding } from '../../../src/core/encoding/baseEncoding';

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
        return multiCheck(enc, 'data.responseMap', [
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