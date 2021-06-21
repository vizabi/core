import { dataSource } from './dataSource'
import { createStore } from '../genericStore'
import { defaultDecorator } from '../utils'

export const dataSourceStore = createStore(dataSource);

dataSourceStore.createAndAddType = function(type, readerObject) {
    this.addType(type, defaultDecorator({
        base: dataSource,
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
