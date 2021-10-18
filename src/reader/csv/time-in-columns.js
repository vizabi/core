import { ucFirst } from "../../core/utils";

const MISSED_INDICATOR_NAME = 'indicator';

export function timeInColumns({columns, rows, hasNameColumn, timeKey = "time", keySize = 1}, ERRORS, parsers) {
    let nameConcept = null;
    
    // remove column "name" as array's k+1 th element, but remember its header in a variable.
    // if it's an empty string, call it "name"
    // name column is not at its original index because it was moved by csv reader "load" method
    if (hasNameColumn) {
        nameConcept = columns.splice(keySize + 1, 1)[0] || 'name';
    }
    
    const missedIndicator = parsers && parsers[timeKey] && !!parsers[timeKey](columns[keySize]);

    if (missedIndicator) {
        console.warn('Indicator column is missed.');
    }

    const indicatorKey = missedIndicator ? MISSED_INDICATOR_NAME : columns[keySize];
    const concepts = columns.slice(0, keySize)
        .concat(timeKey)
        .concat(nameConcept || [])
        .concat(missedIndicator ? ucFirst(MISSED_INDICATOR_NAME) : rows.reduce((result, row) => {
            const concept = row[indicatorKey];
            if (!result.includes(concept) && concept) {
            result.push(concept);
            }
            return result;
    }, []));

    const indicators = concepts.slice(keySize + 1 + (nameConcept ? 1 : 0));
    const [entityDomain] = concepts;

    return {
        columns: concepts,
        rows: rows.reduce((result, row) => {
            const rowEntityDomain = row[entityDomain];
            const resultRows = result.filter(resultRow => resultRow[entityDomain] === rowEntityDomain);

            if (resultRows.length) {
            if (resultRows[0][row[indicatorKey]] !== null) {
                throw {
                    name: ERRORS.REPEATED_KEYS,
                    message: `indicator: ${row[indicatorKey]}, key: ${row[entityDomain]}`
                }
            }

            resultRows.forEach(resultRow => {
                resultRow[row[indicatorKey]] = row[resultRow[timeKey]];
            });
            } else {
            Object.keys(row).forEach(key => {
                if (![entityDomain, indicatorKey, nameConcept].includes(key)) {
                const domainAndTime = {
                    [entityDomain]: row[entityDomain], 
                    [timeKey]: key
                };
                const optionalNameColumn = !nameConcept ? {} : {
                    [nameConcept]: row[nameConcept]
                };
                const indicatorsObject = indicators.reduce((indResult, indicator) => {
                    indResult[indicator] = missedIndicator || row[indicatorKey] === indicator ? row[key] : null;
                    return indResult;
                }, {});

                result.push(Object.assign(domainAndTime, optionalNameColumn, indicatorsObject));
                }
            });
            }

            return result;
        }, [])
    };
}