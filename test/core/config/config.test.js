import { createConfig } from "../../../src/core/config/config";
import { toJS, configure, _resetGlobalState, autorun } from "mobx";
import { observable } from "mobx";

//configure({ disableErrorBoundaries: true })

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
        debugger;
        expect(cfg.z).toMatchObject({y : 5});
    });

    it('handles changing reference targets', () => {
        const cfg = createConfig(cfg2);
        expect(cfg.z).toBe(5);
        cfg.x.y = 3;
        expect(cfg.z).toBe(3);
    });

    it('set non existing', () => {
        const cfg = createConfig(cfg2);
        cfg.a = 5;
        expect(cfg.a).toBe(5);
    });

    it('set non existing one level deep', () => {
        const cfg = createConfig(cfg2);
        cfg.x.a = 5;
        expect(cfg.x.a).toBe(5);
    });

    it('handles new references', () => {
        const obj = { 
            x: { y: 5 },
            z: { ref: "x.y" }
        };
        const cfg = createConfig(obj);
        expect(cfg.z).toBe(obj.x.y);
        cfg.a = { ref: "x.y" };
        expect(cfg.a).toBe(obj.x.y);
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

    it('handles new, recursive references', () => {
        const obj = { 
            x: { y: 5 },
            z: { ref: "x.y" }
        };
        const cfg = createConfig(obj);
        cfg.a = { ref: "z" };
        expect(cfg.a).toBe(obj.x.y);
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

    it('can be used in an observer', () => {
        const cfg = createConfig({ 
                x: { y: 5 }
        })
        const foo = observable({
            cfg,
            get bar() {
                return this.cfg.x.y + 2;
            }
        });
        return new Promise((res, rej) => {
            autorun(() => {
                expect(foo.bar).toBe(7);
                res();
            })
        });
    });

});

afterEach(() => {
    _resetGlobalState()
})