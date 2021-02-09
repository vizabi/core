import { inlineReader } from "./../inline/inline";
import { guessDelimiter } from './guess-delimiter.js';
import { timeInColumns } from './time-in-columns';

const GOOGLE_DOC_PREFIX = 'https://docs.google.com/spreadsheets/';
const MISSED_INDICATOR_NAME = 'indicator';
const ERRORS = {
    WRONG_TIME_COLUMN_OR_UNITS: 'reader/error/wrongTimeUnitsOrColumn',
    NOT_ENOUGH_ROWS_IN_FILE: 'reader/error/notEnoughRows',
    UNDEFINED_DELIMITER: 'reader/error/undefinedDelimiter',
    EMPTY_HEADERS: 'reader/error/emptyHeaders',
    DIFFERENT_SEPARATORS: 'reader/error/differentSeparators',
    FILE_NOT_FOUND: 'reader/error/fileNotFoundOrPermissionsOrEmpty',
    REPEATED_KEYS: 'reader/error/repeatedKeys'
};

let cache = {};

export function csvReader({ 
        path = "data.csv", 
        sheet = "", 
        exernalTextReader,
        externalJsonReader,
        hasNameColumn = false,
        isTimeInColumns = false,
        assetsPath = "",
        delimiter = "",
        keyConcepts = [], 
        dtypes 
    }) {
    
    const cacheKey = path + sheet;

    path = _googleSpreadsheetURLAdaptor(path, sheet);

    return inlineReader({ 
        values: getValues(),
        getDatasetInfo,
        getAsset,
        keyConcepts,
        dtypes
    });

    function getValues(){
        return cache[cacheKey] ? cache[cacheKey] : cache[cacheKey] = loadFile()
            .then(guessDelim)
            .then(parseTextToTable)
            .then(transformNameColumn)
            .then(transformTimeInColumns)
            .then(returnRowsOnly);
    }
  
    function loadFile(){
        let textReader = exernalTextReader || d3.text;
        return textReader(path)
            .catch(error => {
                error.name = ERRORS.FILE_NOT_FOUND;
                error.message = `No permissions, missing or empty file: ${path}`;
                error.endpoint = path;
                return error;
            });
    }

    function guessDelim(text){
        if (!delimiter) delimiter = guessDelimiter(text, ERRORS);
        if (delimiter.error) throw makeError(delimiter.error);
        return text;
    }

    function parseTextToTable(text){

        const rows = d3.dsvFormat(delimiter)
            //parse, and exclude empty rows
            .parse(text, row => Object.values(row).every(v => !v) ? null : row);

        //remove empty columns
        const columns = rows.columns.filter(c => c !== "");

        return {rows, columns};
    }

    function transformNameColumn({rows, columns}){
        // move column "name" so it goes after "time"
        // turns [name, geo, gender, time, lex] into [geo, gender, time, name, lex]
        if (hasNameColumn)
            columns.splice(this.keySize + 1, 0, columns.splice(this.nameColumnIndex, 1)[0]);

        return {rows, columns};
    }

    function transformTimeInColumns({rows, columns}){

        if (isTimeInColumns)
            return timeInColumns({rows, columns});
        
        return {rows, columns};
    }

    function returnRowsOnly({rows}){
        return rows.map(row => d3.autoType(row));
    }

    function makeError(e){
        delete cache[cacheKey];
        return e;
    }

    /**
     * This function returns info about the dataset
     * in case of CSV reader it's just the name of the file
     * @returns {object} object of info about the dataset
     */
    function getDatasetInfo() {
        return {name: sheet ? sheet : path.split('/').pop()};
    }

    function getAsset(assetName) {
        const path = assetsPath + assetName;
        const jsonReader = externalJsonReader || d3.json;

        return jsonReader()
            .catch(error => {
                error.name = ERRORS.FILE_NOT_FOUND;
                error.message = `No permissions, missing or empty file: ${path}`;
                error.endpoint = path;
                return error;
            });
    }

    function _googleSpreadsheetURLAdaptor(path, sheet) {
      // adjust path if given a path to a google doc but without the correct export suffix. the first sheet is taken since none is specified
      if (path.includes(GOOGLE_DOC_PREFIX) && !path.includes('tqx=out:csv') && !path.includes('/pub?')) {
          const googleDocParsedUrl = path.split(GOOGLE_DOC_PREFIX)[1].split('/');
          const googleDocId = googleDocParsedUrl[googleDocParsedUrl.indexOf('d') + 1];
          return GOOGLE_DOC_PREFIX 
              + 'd/' 
              + googleDocId 
              + '/gviz/tq?tqx=out:csv' 
              + (sheet ? '&sheet=' + encodeURI(sheet.toLowerCase()) : '' );
      } else {
          return path;
      }
    }
    
}