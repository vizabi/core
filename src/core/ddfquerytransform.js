import { deepmerge } from "./utils";

// only on base level now, should be recursive
export function dotToJoin(query) {
    const props = query.where && Object.keys(query.where);
    if (!props || props.length == 0)
        return query;

    const where = query.where,
        newq = deepmerge({}, query);

    let i = 0;

    props.forEach(p => {
        const s = p.split('.');
        if (s.length > 1) {
            const [key, value] = s;
            const filter = where[p];
            const joinid = "$" + key;

            if (!newq.join) newq.join = {};
            if (!newq.join[joinid]) {
                newq.join[joinid] = {
                    key,
                    where: {
                        [value]: filter
                    }
                }
                if (newq.where[key]) {
                    newq.join[joinid].where[key] = newq.where[key];
                }
                newq.where[key] = joinid;
            } else {
                newq.join[joinid].where[value] = filter;
            }
            delete newq.where[p];
        }
    });

    //console.log("Transformed query: ", query, newq);
    return newq;
}

// needed for WS
export function addExplicitAnd(query) {
    // return if no where or only single where
    const props = query.where && Object.keys(query.where);
    if (!props || props.length < 2)
        return query;

    const newq = deepmerge({}, query);
    newq.where = {
        "$and": []
    }
    props.forEach(prop => {
        newq.where["$and"].push({
            [prop]: query.where[prop]
        })
    })

    //console.log("Transformed query: ", query, newq);
    return newq;
}