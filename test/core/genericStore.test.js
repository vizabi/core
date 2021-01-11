import { createStore } from '../../src/core/genericStore';
import { markerStore } from '../../src/core/marker/markerStore';
import { autorun, observable } from 'mobx'

const config = observable({ foo: "bar" })

describe('setting and getting', () => {

    it('create a model', () => {
        const store = createStore();
        const model = store.create(config);
        expect(model.config.foo).toBe('bar')
        expect(store.getAll().length).toBe(0)
    });

    it('create a model by name and can get same model by name', () => {
        const store = createStore();
        const model = store.create(config, null, 'baz');
        const getBaz = store.get('baz');
        expect(getBaz).toBe(model)
        expect(store.getAll().length).toBe(1)
    });

})


describe('setting while observed', () => {

    // this throws an error in mobx 4 & 5. No error in 6 (but can create circular dependency).
    it.skip('adding to store through computed while observed', () => {
        const store = createStore();
        // observe store configRef
        autorun(() => console.log(store.getAll()))
        const obs2 = observable({
            // computed which will trigger action to add to configRef map
            get foo() { return store.create({ another: 'one' }, null, 'baz') }
        })
        // this is fine. Not sure why, it's also changing the observed map, which can create an infinite autorun-loop
        autorun(() => console.log(store.create({ another: 'two' }, null, 'baz')))
        // this is not fine, because it calls action through computed. 
        autorun(() => console.log(obs2.foo.config.another))
    });

})