import { observable } from 'mobx'

export default window.appState = observable({
    margin: {
        top: 20,
        right: 20,
        bottom: 30,
        left: 40
    },
    wrapper: {
        width: 400,
        height: 500
    },
    get width() {
        return this.wrapper.width - this.margin.left - this.margin.right;
    },
    get height() {
        return this.wrapper.height - this.margin.top - this.margin.bottom;
    }
});