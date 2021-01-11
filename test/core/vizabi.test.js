import { getLayer } from "../../src/core/config/config";
import vizabi from "../../src/core/vizabi";
import { check, multiCheck } from "../utils";

let marker1 = {
    data: {
        source: {
            values: [{ x: 1, y: 2}, {x: 5, y: 6 }]
        }
    },
    encoding: {
        foo: { data: { concept: 'x' }}
    }
}

let config1 = { markers: { 
    first: marker1
} }

describe('vizabi factory', () => {

    it('can be initiated with simple config and returns inline data', (done) => {
        function callback(data) {
            try {
                expect(data[0].foo).toBe(1)
                done();
            } catch (error) {
                done(error);
            }
        }
        let models = vizabi(config1)
        check(models.markers.first, 'dataArray').then(callback);
    });

    it('can be initiated with layered config and read user config', () => {
        let models = vizabi([{}, config1])
        let userCfg = getLayer(models.markers.first.config, 0);
        return multiCheck(models.markers.first, 'dataArray', [
            {
                check(data) {
                    expect(data[0].foo).toBe(1);
                    expect(userCfg).toEqual(undefined);
                }
            }, 
            { 
                action() {
                    models.markers.first.encoding.foo.setWhich({ key: [], value: 'y' })
                },
                check(data) {
                    expect(data[0].foo).toBe(2);
                    userCfg = getLayer(models.markers.first.config, 0);
                    expect(userCfg).toEqual({ encoding: { foo: { data: { concept: 'y', space: [] } } } });
                }
            }
        ]);
    });

});
describe('marker factory', () => {

    it('can be initiated with simple config and returns inline data', (done) => {
        function callback(data) {
            try {
                expect(data[0].foo).toBe(1)
                done();
            } catch (error) {
                done(error);
            }
        }
        const marker = vizabi.marker(marker1)
        check(marker, 'dataArray').then(callback);
    });
});