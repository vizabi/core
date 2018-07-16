export const createKey = (space, row) => space.map(dim => row[dim]).join('-');

export const isNumeric = (n) => !isNaN(n) && isFinite(n);

// https://www.webreflection.co.uk/blog/2015/10/06/how-to-copy-objects-in-javascript
// rewrote for clarity and make sources overwrite target (mimic Object.assign)
export function assign(target, ...sources) {
    sources.forEach(source => {
        Object.keys(source).forEach(property => {
            Object.defineProperty(target, property, Object.getOwnPropertyDescriptor(source, property));
        });
    });
    return target;
}