import { action } from 'mobx';
import { applyDefaults, deepclone } from "./utils";

const defaultConfig = {
    palette: {},
}

const defaults = {
    defaultPalettes: {
        "_continuous": {
          "_default": "#ffb600",
          "0": "#8c30e8", //"hsl(270, 80%, 55%)",
          "25": "#30a3e8", //"hsl(202.5, 80%, 55%)",
          "50": "#30e85e", //"hsl(135, 80%, 55%)",
          "75": "#e2c75a", //"hsl(48, 70%, 62%)",
          "100": "#e83030" //"hsl(0, 80%, 55%)"
        },
        "_ordinal": {
          "_default": "#ffb600",
          "0": "#4cd843",
          "1": "#e83739",
          "2": "#ff7f00",
          "3": "#c027d4",
          "4": "#d66425",
          "5": "#0ab8d8",
          "6": "#bcfa83",
          "7": "#ff8684",
          "8": "#ffb04b",
          "9": "#f599f5",
          "10": "#f4f459",
          "11": "#7fb5ed"
        },
        "_default": {
          "_default": "#ffb600"
        }
    },
}

export function palette(config = {}, parent) {

    applyDefaults(config, defaultConfig);

    return {
        config,
        parent,
        get encoding() {
            return this.parent.parent;
        },
        get colorConceptProp() {
            const conceptProps = this.encoding.data.conceptProps;
            return conceptProps ? JSON.parse(this.encoding.data.conceptProps.color || "{}") : {};
        },
        get defaultPalettes() {
            return this.config.defaultPalettes || defaults.defaultPalettes;
        },
        get defaultPalette() {
            let palette;
            
            if (this.encoding.data.isConstant) {
                //an explicit hex color constant #abc or #adcdef is provided
                if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/.test(this.encoding.data.constant)) {
                    palette = { "_default": this.encoding.data.constant };
                } else {
                    palette = deepclone(this.defaultPalettes["_default"]);
                }
            } else if (this.colorConceptProp.palette) {
                //specific color palette from enc concept properties
                palette = deepclone(this.colorConceptProp.palette);
            } else {
                palette = deepclone(this.defaultPalettes[this.paletteType]);
            }
            
            return palette;
        },
        get paletteType() {
            //constant
            if (this.encoding.data.isConstant) return "_default";
            //measure
            if (["time", "measure"].includes(this.encoding.data.conceptProps.concept_type)) return "_continuous";
            
            return "_ordinal";
        },
        get paletteLabels() {
            return this.colorConceptProp.paletteLabels;
        },
        get palette() {
            const obj = Object.assign({}, this.defaultPalette, this.config.palette); 
            
            //remove null values from the result of merging
            Object.keys(obj).forEach(key => {
                if (!obj[key]) delete obj[key];
            });

            return obj;
        },
        get defaultColor() {
            return this.getColor("_default") || this.defaultPalettes["_default"]["_default"];
        },
        get paletteDomain() {
            return Object.keys(this.palette).filter(f => f !== "_default").sort((a, b) => a - b);
        },
        get isUserSelectable() {
            return this.colorConceptProp.hasOwnProperty("selectable") ? this.colorConceptProp.selectable : true;
        },
        get shades() {
            return this.colorConceptProp.shades;
        },
        // args: {colorID, shadeID}
        getColorShade(args) {
            if (!args) return utils.warn("getColorShade() is missing arguments");

            // if colorID is not given or not found in the palette, replace it with default color
            //if (!args.colorID || !this.defaultPalette[args.colorID]) args.colorID = "_default";

            const color = this.palette[args.colorID];
            // if the resolved colr value is not an array (has only one shade) -- return it
            if (!Array.isArray(color)) return args.shadeID == "shade" ? d3.rgb(palette[args.colorID] || this.parent.d3Scale(args.colorID)).darker(0.5).toString() : color;

            return color[this.shades[args.shadeID]];
        },
        getColor(key, palette = this.palette) {
            const color = palette[key];
            return Array.isArray(color) ? color[0] : color;
        },
        getColorByIndex(index, palette = this.palette) {
            const length = Object.keys(palette).filter(f => f !== "_default").length;
            const color = palette[index % length];
            return Array.isArray(color) ? color[0] : color;
        },
        setColor: action('setColor', function (value, pointer) {
            if(!this.parent.config.palette) this.parent.config.palette = {palette: {}};
            this.parent.config.palette.palette["" + pointer] = value ? d3.color(value).hex() : value;
        }),
        removeColor: action('removeColor', function (pointer) {
            if(this.config.palette.hasOwnProperty("" + pointer))
                delete this.config.palette["" + pointer];
        })
    }
}