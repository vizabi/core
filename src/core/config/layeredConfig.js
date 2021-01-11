import { action, observable } from "mobx";
import { isNonNullObject } from "../utils";

const layerSymb = Symbol.for('vizabi-config-layers');

export function layeredConfig(layers, writeRoot, path=[]) {

    layers = observable(layers);

    //console.log('new proxy', { layers, writeRoot, path })
    const prox = new Proxy({}, {
        get(target, prop) {
            //console.log('getting prop ' + prop.toString() + ' from ', { target, layers })
            if (prop == Symbol.for('vizabi-config-layers'))
                return layers;
            if (prop == Symbol.for('vizabi-config-setProxy'))
                return function (prop, val, idx) {
                    setProxy(target, prop, val, idx);
                    //fillMissingObjects(writeRoot, path, idx);
                }

            for (let layer of layers) {
                if (layer && prop in layer) {
                    if (typeof layer[prop] == 'object' && !Array.isArray(layer[prop])) {
                        // return the next layered proxy
                        return target[prop];
                    } else {
                        // observable value
                        return layer[prop];
                    }
                }
            }
        },
        set(target, prop, val) {
            //console.log('setting ', { target, prop, val, path });
            return setProxy(target, prop, val, 0);
        }
    });

    function setProxy(target, prop, val, idx) {

        action(() => {
                
            setLayers();

            setTarget();
            
            function setLayers() {
                if (idx > 0) { // setting fallback
                    setLayer();
                    if (existsInTop(prop, val)) {
                        removeRedundantTop();
                    }
                } else { // setting top
                    // If value exists in fallback configs, remove from top config. 
                    // If removal creates empty objects, remove those recursively. 
                    if (existsInFallback(prop, val)) {
                        removeRedundantTop();
                    } else {
                        // only set top layer if didn't exist in fallback
                        setLayer();
                    }
                }
            }

            function setLayer() {
                // Filling missing objects on init errors because sub-proxies aren't created yet
                // Nor is it needed because `root.x.y = 5` will not happen. Init builds up from root.
                if (!layers[idx]) debugger;
                if (!layers[idx]) // && !init) 
                    fillMissingObjects(writeRoot, path, idx);
                layers[idx][prop] = val;
            }

            function removeRedundantTop() {
                if (layers[0] && prop in layers[0]) {
                    delete layers[0][prop]; 
                    removeEmptyObjects(writeRoot, path);
                }
            }

            function existsInTop(prop, val) {
                return layers[0] && prop in layers[0] && layers[0][prop] == val;
            }
            function existsInFallback(prop, val) {
                for (let cfg of layers.slice(1)) {
                    if (cfg && prop in cfg && cfg[prop] == val) {
                        return true;
                    }
                }
                return false;
            }

            function setTarget() {
                //debugger;
                if (isTopLayer(idx, prop)) {
                    if (typeof val == 'object' && !Array.isArray(val)) {
                        target[prop] = layeredConfig(layeredStep(layers, prop), writeRoot, path.concat([prop]));
                    } else {
                        target[prop] = val;
                    }
                }
            }
            function isTopLayer(idx, prop) {
                return layers.slice(0, idx).every(layer => !(prop in layer));
            }
        })();
        return true;
    }

    if (!writeRoot) writeRoot = prox;
    
    // initial filling of proxy using its setter (so sub-proxies get created)
    //let init = true;
    const combined = Object.assign({}, ...layers.slice().reverse());
    for (const prop in combined) {
        prox[prop] = combined[prop];
    }
    //init = false;
    return prox;
}

function layeredStep(layers, prop) {
    return layers.map(cfg => cfg && isNonNullObject(cfg[prop]) ? cfg[prop] : {})
}

function removeEmptyObjects(node, path) {
    _removeEmptyObjects(node, path.slice());
}
function _removeEmptyObjects(node, path) {
    const step = path.shift();
    if (path.length > 0) {
        // head-recursion allows leaf->root deleting
        removeEmptyObjects(node[step], path);
    }
    const topLayer = getWriteLayer(node);
    if (step && Object.keys(topLayer[step]).length == 0) {
        delete topLayer[step]; // remove from top config
        getLayers(node[step])[0] = undefined; // remove from layers in deeper proxy
    }
}


function fillMissingObjects(root, path, layerIndex = 0) {
    //console.log('filling missing', { root, path})
    let curr = root;
    let writeLayer;
    debugger;
    for (let step of path) {
        //console.log('fillstep', { step, curr})
        writeLayer = getLayer(curr, layerIndex)
        if (!(step in writeLayer)) {
            //console.log('step not found in writeLayer, filling!', { step, writeLayer })
            writeLayer[step] = {};
            curr[step][layerSymb][layerIndex] = writeLayer[step];
            //curr[step] = {}; // set to next step, saves it as observable
            //writeLayer[step] = getLayer(curr[step], layerIndex); // set observable to current layer
        }
        curr = curr[step];
    }
}

function getLayers(prox) {
    return prox[layerSymb];
}
function getLayer(prox, idx) {
    return getLayers(prox)[idx];
}
function getDefaultLayer(prox) {
    const layers = getLayers(prox);
    return layers[layers.length - 1];
}
function getWriteLayer(prox) {
    return getLayers(prox)[0];
}