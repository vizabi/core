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

// needed for WS. adds $AND statements RECURSIVELY
export function addExplicitAnd(query) {

    function recurse(obj) {
        // leaves returned immediately
        if (!obj || typeof obj !== 'object') 
            return obj;
    
        // arrays get traversed recursively
        if (Array.isArray(obj)) 
            return obj.map(m => recurse(m));

        const keys = Object.keys(obj);

        // objects with exactly one property get traversed recursively
        // these may already be $and, $or etc but it's ok, because at the next 
        // recursive pass they will be treated as arrays
        if (keys.length === 1)
            return {[keys[0]]: recurse(obj[keys[0]])}; 

        // objects with more than one prop get wrapped in "$and"
        if (keys.length > 1) 
            return {"$and": keys.map(key => ({[key]: recurse(obj[key])}) )}
    }

    const newq = deepmerge({}, query);
    newq.where = recurse(query.where);

    //do the same for "where" clause of each "join"
    if (query.join){
        for (let joinKey in newq.join) {
            const where = newq.join[joinKey].where;
            if (where) newq.join[joinKey].where = recurse(query.join[joinKey].where);
        }  
    }
   
    //console.log("Transformed query: ", query, newq);
    return newq;
}

  