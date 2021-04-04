import { action } from "mobx";
import { defaultDecorator } from "../utils";
import { filter } from "./filter";

export const trailFilter = defaultDecorator({
    base: filter,
    functions: {
        set: action("setFilter", function(d) {
            return this.parent.parent.setTrail(d);
        })
    }
});