import { baseDataSource } from './baseDataSource'
import { createStore } from '../genericStore'
import { defaultDecorator } from '../utils'

export const dataSourceStore = createStore(baseDataSource);

dataSourceStore.createAndAddType = function(type, readerObject) {
    this.addType(type, defaultDecorator({
        base: baseDataSource,
        functions: {
            get reader() {
                // copy reader object (using original would only allow one datasource of this type)
                const reader = Object.assign({}, readerObject);
                reader.init(this.config || {})
                return reader;
            }
        }
    }));
}
