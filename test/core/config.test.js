import { resolveRef } from '../../src/core/config';

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

const refWithTransform = { 
    bubble: {
        encoding: {
            color: { data: {
                concept: "regions",
                locale: "en"
            } },
        }
    },
    legend: {data: {ref: {
        transform: "entityConceptSkipFilter",
        path: "bubble.encoding.color"
    }}}
}

describe("references", () => {

    it("resolves a simple reference", () => {
        expect(resolveRef(cfg1.y, cfg1).value).toBe(5);
    })

    it("resolves a chained reference", () => {
        expect(resolveRef(cfg2.z, cfg2).value).toBe(5);
    })

    it("resolves a reference to an object", () => {
        expect(resolveRef(objRef.z, objRef).value).toEqual({y: 5});
    })

    it("resolves a reference with custom transform entityConceptSkipFilter", () => {
        const resolvedRef = resolveRef(refWithTransform.legend.data, refWithTransform).value;
        expect(resolvedRef.space).toEqual(["regions"]);
        expect(resolvedRef.locale).toEqual("en");
        expect(resolvedRef.source).toBeUndefined();
    })
})