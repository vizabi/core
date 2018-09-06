import { applyDefaults, assign } from "../utils";
import { base } from "./base";
import appState from "../appState";

const defaultConfig = {}

export function x(config, parent) {

    applyDefaults(config, defaultConfig);
    const s = base(config, parent);

    return assign(s, {
        ordinalScale: "point",
        get range() {
            return [0, appState.width]
        }
    });
}