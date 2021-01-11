import { autorun } from "mobx";


export function check(model, prop) {
    let destruct;
    let promise = new Promise((resolve, reject) => {
        destruct = autorun(() => {
            if (model.state == 'fulfilled') {
                resolve(model[prop]);
            }
        });
    });
    return promise.then(resp => (destruct(), resp));
}

export function multiCheck(model, prop, fns) {
    return new Promise((resolve, reject) => {
        let { check, action } = fns.shift();
        const destruct = autorun(() => {
            if (model.state == 'fulfilled') {
                check(model[prop]); 
                if (fns.length > 0) {
                    ({ check, action } = fns.shift());
                    if (action) action();
                } else {
                    destruct();
                    resolve();
                }
                if (fns.length == 0 && !check) {
                    destruct();
                    resolve();
                }
            }
        }, { name: 'multicheck' });
    });
}
