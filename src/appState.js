import { observable } from 'mobx'

export default window.appState = observable({
    margin: {
        top: 20,
        right: 20,
        bottom: 30,
        left: 40
    },
    size: {
        width: 400,
        height: 500
    },
    get width() {
        return this.size.width - this.margin.left - this.margin.right;
    },
    get height() {
        return this.size.height - this.margin.top - this.margin.bottom;
    }
});