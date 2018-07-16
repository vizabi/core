import { promisedComputed } from 'computed-async-mobx'
import { observable, action } from 'mobx'
import { assign } from './utils'

const dataConfig = {
    gap: {
        file: "fullgap.gapodd.csv"
    },
    soder: {
        file: "soder.csv"
    }
}

const modelFactory = function(config) {

    const modelCreators = {
        base: () => ({
            file: "data.csv",
            get data() {
                return promisedComputed([],
                    async() => await d3.csv(this.file, tryParseRow)
                )
            }
        }),
        config: config => {
            const obj = {};
            const props = ["file"];
            props.forEach(prop => {
                if (config[prop]) {
                    delete obj[prop];
                    obj[prop] = config[prop];
                }
            });
            return obj;
        }
    }

    // default encoding object
    let model = modelCreators.base();

    assign(model, modelCreators.config(config))

    return observable(model);
}


export default window.dataStore = observable({
    models: new Map(),
    get: function(id) {
        return this.models.get(id);
    },
    set: action(function(id, config) {
        this.models.set(id, modelFactory(config));
    }),
    setMany: action(function(configs) {
        for (let id in configs) {
            this.set(id, configs[id]);
        }
    })
});

dataStore.setMany(dataConfig);

const tryParseRow = d => {
    for (let key in d) {
        d[key] = parse(d[key]);
    }
    return d;
}

const parse = (val) => (val == '') ? null : +val || val;