import { DataFrame } from "../dataFrame";

const directions = {
    ascending: 1,
    decending: -1
}

/*
    order_by can be
    a string - projected column along which to sort the DF: "color"
    an array of strings: columns along which to nested-sort the DF: ["color", "side"]
    an array of objects: columns along which to nested-sort the DF: [{ ["color"]: ascending }]
    or a map of columns with their custom sorting order: color => ["asia", "africa"]
*/
export function order(df, order_by = []) {
    if (order_by.length == 0) return df;

    const data = Array.from(df.values());
    const orderNormalized = normalizeOrder(order_by instanceof Map ?  [...order_by.keys()] : order_by);
    const n = orderNormalized.length;

    data.sort((a,b) => {
        for (var i = 0; i < n; i++) {
            const order = orderNormalized[i];
            if (order_by instanceof Map && order_by.get(order.concept))
                return (order_by.get(order.concept).indexOf(a[order.concept]) - order_by.get(order.concept).indexOf(b[order.concept]));
            if (a[order.concept] < b[order.concept])
                return -1 * order.direction;
            else if (a[order.concept] > b[order.concept])
                return order.direction;
        } 
        return 0;
    });

    data.key = df.key;

    return DataFrame(data);
}

/**    
 * Process ["geo"] or [{"geo": "asc"}] to [{ concept: "geo", direction: 1 }];
 * @param {} order 
 */
function normalizeOrder(order_by) {
    if (typeof order_by === "string") 
        return [{ concept: order_by, direction: directions.ascending }];
    return order_by.map(orderPart => {
        if (typeof orderPart == "string") {
            return { concept: orderPart, direction: directions.ascending };
        }	else {
            const concept   = Object.keys(orderPart)[0];
            const direction = orderPart[concept] == "asc" 
                ? directions.ascending 
                : directions.decending;
            return { concept, direction };
        }
    });
}