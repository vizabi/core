import { layeredConfig } from "../../../src/core/config/layeredConfig";
import { autorun, observable, toJS } from "mobx";
import { getLayer } from "../../../src/core/config/config";

function createLayerConfig() {
        
    const cfg1 = {
        array: ['foo','bar'],
        x: 1,
        y: { z: 2 }
    }

    const cfg2 = { 
        array: ['foo'],
        x: { y: 3 },
        y: { z: 4 },
        a: 5,
    }

    const cfg3 = { 
        x: 5,
        z: { b: 6 }
    }
   
    const layers = [cfg1, cfg2, cfg3];
    const config = layeredConfig(layers);

    return { config, layers }
}

describe('layeredConfig', () => {

    it('returns normal values', () => {
        const { config, layers } = createLayerConfig();
        expect(config.x).toBe(1);
        expect(config.x.y).toBe(undefined);
        expect(config.a).toBe(5);
        debugger;
        expect(config.z.b).toBe(6);
    });
    
    it('returns normal array values', () => {
        const { config, layers } = createLayerConfig();
        expect(config.array).toEqual(['foo','bar']);
    });

    it('set top cfg value', () => {
        const { config, layers } = createLayerConfig();
        config.x = 2;
        expect(getLayer(config, 0).x).toBe(2);
    });

    it('set top overwriting middle value', () => {
        const { config, layers } = createLayerConfig();
        expect(config.a).toBe(5);
        config.a = 8;
        expect(getLayer(config, 0).a).toBe(8);
    });

    it('set non existing', () => {
        const { config, layers } = createLayerConfig();
        expect(config.z.c).toBe(undefined);
        config.z.c = 8;
        expect(getLayer(config.z, 0).c).toBe(8);
        expect(config.z.c).toBe(8);
    });

    it('set to fallback value removes from top', () => {
        const { config, layers } = createLayerConfig();
        expect(getLayer(config.y, 0).z).toBe(2);
        config.y.z = 4;
        expect(getLayer(config.y, 0)).toBe(undefined);
        config.y.z = 6;
        expect(getLayer(config.y, 0).z).toBe(6);
    });

    it('set deep top value', () => {
        const { config, layers } = createLayerConfig();
        expect(getLayer(config, 0).z).toBe(undefined);
        expect(config.z.b).toBe(6);
        config.z.b = 8
        expect(config.z.b).toBe(8);
        expect(getLayer(config.z, 0).b).toBe(8);
    });

    it('set to fallback value twice', () => {
        const { config, layers } = createLayerConfig();
        expect(config.y.z).toBe(2);
        config.y.z = 4;
        config.y.z = 4;
        expect(config.y.z).toBe(4);
    });

    it('get layers from config', () => {
        const { config, layers } = createLayerConfig();
        expect(config[Symbol.for('vizabi-config-layers')][0]).toEqual(layers[0]);
    });

    it('get layers from config after traversing', () => {
        const { config, layers } = createLayerConfig();
        expect(config.y[Symbol.for('vizabi-config-layers')][0]).toEqual(layers[0].y);
    });

    it('observable layers and config', () => {
        const cfg1 = {
            x: 1,
            y: { z: 2 }
        }
    
        const cfg2 = { 
            x: { y: 3 },
            y: { z: 4 },
            a: 5,
        }
    
        const cfg3 = { 
            x: 5,
            z: { b: 6 }
        }
       
        const layers = observable([cfg1, cfg2, cfg3]);
        const config = layeredConfig(layers);
        let runs = 0;
        autorun(() => {
            debugger;
            runs++;
            expect(config.x).toBe(layers[0].x)
        });
        config.x = 3;
        expect(runs).toBe(2);
    });

})