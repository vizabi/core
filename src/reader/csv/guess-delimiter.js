
export function guessDelimiter(text, ERRORS) {
    const comma = ',',  semicolon = ';';
    const stringsToCheck = 2;
    const rows = _getRows(text.replace(/"[^\r]*?"/g, ''), stringsToCheck);

    if (rows.length !== stringsToCheck) {
        return {error: ERRORS.NOT_ENOUGH_ROWS_IN_FILE};
    }

    const [header, firstRow] = rows;
    const commasCountInHeader = _countCharsInLine(header, comma);
    const semicolonsCountInHeader = _countCharsInLine(header, semicolon);
    const commasCountInFirstRow = _countCharsInLine(firstRow, comma);
    const semicolonsCountInFirstRow = _countCharsInLine(firstRow, semicolon);

    if (
        _checkDelimiters(
            commasCountInHeader,
            commasCountInFirstRow,
            semicolonsCountInHeader,
            semicolonsCountInFirstRow
        )
    ) return comma;
    else if (
        _checkDelimiters(
            semicolonsCountInHeader,
            semicolonsCountInFirstRow,
            commasCountInHeader,
            commasCountInFirstRow
        )
    ) return semicolon;

    // failed to identify a delimiter
    return {error: ERRORS.UNDEFINED_DELIMITER};
}

function _checkDelimiters(
    firstDelimiterInHeader,
    firstDelimiterInFirstRow,
    secondDelimiterInHeader,
    secondDelimiterInFirstRow
) {
    return firstDelimiterInHeader === firstDelimiterInFirstRow
        && firstDelimiterInHeader > 1
        && (
            (secondDelimiterInHeader !== secondDelimiterInFirstRow)
            || (!secondDelimiterInHeader && !secondDelimiterInFirstRow)
            || (firstDelimiterInHeader > secondDelimiterInHeader && firstDelimiterInFirstRow > secondDelimiterInFirstRow)
        );
}

function  _getRows(text, count = 0) {
    const re = /([^\r\n]+)/g;
    const rows = [];

    let rowsCount = 0;
    let matches;

    do {
        matches = re.exec(text);
        if (matches && matches.length > 1) {
            ++rowsCount;
            rows.push(matches[1]);
        }
    } while (matches && rowsCount !== count);

    return rows;
}

function _countCharsInLine(text, char) {
    const re = new RegExp(char, 'g');
    const matches = text.match(re);
    return matches ? matches.length : 0;
}