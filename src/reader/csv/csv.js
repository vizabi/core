import { inlineReader } from "./../inline/inline";
import { guessDelimiter } from './guess-delimiter.js';
import { timeInColumns } from './time-in-columns';

const TIME_LIKE_CONCEPTS = ["time", "year", "month", "day", "week", "quarter"];
const NAME_LIKE_CONCEPTS = ["name", "title"];
const GOOGLE_DOC_PREFIX = 'https://docs.google.com/spreadsheets/';
const ERRORS = {
    WRONG_TIME_COLUMN_OR_UNITS: 'reader/error/wrongTimeUnitsOrColumn',
    NOT_ENOUGH_ROWS_IN_FILE: 'reader/error/notEnoughRows',
    UNDEFINED_DELIMITER: 'reader/error/undefinedDelimiter',
    EMPTY_HEADERS: 'reader/error/emptyHeaders',
    DIFFERENT_SEPARATORS: 'reader/error/differentSeparators',
    FILE_NOT_FOUND: 'reader/error/fileNotFoundOrPermissionsOrEmpty',
    REPEATED_KEYS: 'reader/error/repeatedKeys'
};

export function csvReader({ 
        path = "data.csv", 
        sheet = "", 
        externalTextReader,
        externalJsonReader,
        hasNameColumn = false,
        isTimeInColumns = false,
        assetsPath = "",
        delimiter = "",
        keyConcepts, 
        nameColumnIndex,
        dtypes 
    }) {
    
    let cache = {};
    const cacheKey = path + sheet;

    path = _googleSpreadsheetURLAdaptor(path, sheet);

    return Object.assign(inlineReader(getValues().then(({values, dtypes, keyConcepts}) => ({ 
            values,
            keyConcepts,
            dtypes
        })
    )), {
        getDatasetInfo,
        getAsset,
        getValues
    });

    function getValues(){
        return cache[cacheKey] ? cache[cacheKey] : cache[cacheKey] = loadFile()
            .then(guessDelim)
            .then(parseTextToTable)
            .then(transformNameColumn)
            .then(transformTimeInColumns)
            .then(returnValuesDtypesAndKeyConcepts);
    }
  
    function loadFile(){
        let textReader = externalTextReader || d3.text;
        return textReader(path)
            .catch(error => {
                error.name = ERRORS.FILE_NOT_FOUND;
                error.message = `No permissions, missing or empty file: ${path}`;
                error.endpoint = path;
                throw error;
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
        nameColumnIndex = nameColumnIndex ?? NAME_LIKE_CONCEPTS.map(n => columns.indexOf(n)).find(f => f > -1);
        if (hasNameColumn && nameColumnIndex != undefined){
            const nameColumn = columns.splice(nameColumnIndex, 1); //mutates columns array
            const keySize = guessKeyConcepts(columns, keyConcepts).length;
            columns = columns.slice(0, keySize).concat(nameColumn).concat(columns.slice(keySize))
        }
        return {rows, columns};
    }

    function transformTimeInColumns({rows, columns}){

        if (isTimeInColumns) {
            try {
                return timeInColumns({rows, columns}, ERRORS);
            } catch (error) {
                throw makeError(error);
            }
        }
        
        return {rows, columns};
    }

    function returnValuesDtypesAndKeyConcepts({rows, columns}){
        const values = autotype(rows);
        return {
            values,
            keyConcepts: guessKeyConcepts(columns, keyConcepts),
            columns,
            dtypes: columns.reduce((dtypes, column) => {
                const lowerCaseColumn = column.toLowerCase();
                //skip dtypes config for time column which typed to Date with d3.autoType already ('day' and 'month' timeformats for ex.)
                if (TIME_LIKE_CONCEPTS.includes(lowerCaseColumn) && !(values[0][column] instanceof Date)) dtypes[column] = lowerCaseColumn;
                return dtypes;
            }, {})
        }
    }

    function autotype(rows){
        return rows.map(row => d3.autoType(row));
    }

    function guessKeyConcepts(columns, keyConcepts){
        if(keyConcepts) return keyConcepts;
        const index = columns.findIndex((f) => TIME_LIKE_CONCEPTS.includes(f.toLowerCase()));
        // +1 because we want to include time itself as well
        return columns.slice(0, index + 1);
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
                throw error;
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