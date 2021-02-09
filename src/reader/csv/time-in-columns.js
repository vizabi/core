export function timeInColumns({columns, rows}, parsers) {
    const keySize = this.keySize;

    let nameConcept = null;
    
    // remove column "name" as array's k+1 th element, but remember its header in a variable.
    // if it's an empty string, call it "name"
    // name column is not at its original index because it was moved by csv reader "load" method
    if (this.hasNameColumn) {
        nameConcept = columns.splice(keySize + 1, 1)[0] || 'name';
    }
    
    const missedIndicator = parsers && parsers[this.timeKey] && !!parsers[this.timeKey](columns[keySize]);

    if (missedIndicator) {
        Vizabi.utils.warn('Indicator column is missed.');
    }

    const indicatorKey = missedIndicator ? this.MISSED_INDICATOR_NAME : columns[keySize];
    const concepts = columns.slice(0, keySize)
        .concat(this.timeKey)
        .concat(nameConcept || [])
        .concat(missedIndicator ? Vizabi.utils.capitalize(this.MISSED_INDICATOR_NAME) : rows.reduce((result, row) => {
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
                throw this.error(ERRORS.REPEATED_KEYS, null, {
                indicator: row[indicatorKey],
                key: row[entityDomain]
                });
            }

            resultRows.forEach(resultRow => {
                resultRow[row[indicatorKey]] = row[resultRow[this.timeKey]];
            });
            } else {
            Object.keys(row).forEach(key => {
                if (![entityDomain, indicatorKey, nameConcept].includes(key)) {
                const domainAndTime = {
                    [entityDomain]: row[entityDomain], 
                    [this.timeKey]: key
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