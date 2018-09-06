import { applyDefaults } from "./utils";

const defaultConfig = {
    domain: [0, 1],
    range: [0, 1],
    type: "linear"
}

export function scale(config = {}, parent) {

    applyDefaults(config, defaultConfig);

    return {
        config,
        parent,

    }
}