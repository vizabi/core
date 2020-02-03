import { createConfig } from "../../src/core/config";
import { toJS } from "mobx";

const cfg1 = {
    x: 5,
    y: { ref: "x" }
}

const cfg2 = { 
    x: { y: 5 },
    z: { ref: "x.y" }
}

const objRef = { 
    x: { y: 5 },
    z: { ref: "x" }
}


describe('createConfig', () => {

    it('returns normal values', () => {
        expect(createConfig(cfg1).x).toBe(5);
    });

    it('returns referenced values', () => {
        expect(createConfig(cfg1).y).toBe(5);
    });

    it('returns nested references', () => {
        expect(createConfig(cfg2).z).toBe(5);
    });

    it('returns references to objects', () => {
        const cfg = createConfig(objRef);
        expect(cfg.z).toMatchObject({y : 5});
        //compareNonEnumerable(cfg.z, { y: 5 });
    });

    it('handles changing reference targets', () => {
        const cfg = createConfig(cfg2);
        expect(cfg.z).toBe(5);
        cfg.x.y = 3;
        expect(cfg.z).toBe(3);
    });

    it('handles changing references', () => {
        const obj = { 
            x: { y: 5 },
            z: { ref: "x.y" }
        };
        const cfg = createConfig(obj);
        expect(cfg.z).toBe(5);

        cfg.z = { ref: "x" };
        expect(cfg.z).toMatchObject(obj.x);
    });

    it('is iterable', () => {
        expect(Object.keys(createConfig(cfg1))).toEqual(['x','y']);
    });

    it('can resolve references to external roots', () => {
        const cfg = createConfig({
            x: { ref: { path: "y", root: "ext" }}
        }, { ext: { y: "5" }})
        expect(cfg.x).toBe("5");
    });

});