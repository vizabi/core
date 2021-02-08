import { inlineReader } from "./inline";
const GOOGLE_DOC_PREFIX = 'https://docs.google.com/spreadsheets/';
let cache = {};

export function csvReader({ path = "data.csv", sheet = "", keyConcepts = [], dtypes }) {
    
    cacheKey = path + sheet;

    path = _googleSpreadsheetURLAdaptor(path, sheet);
  
    return inlineReader({ 
        values: cache[cacheKey] ? cache[cacheKey] : cache[cacheKey] = d3.csv(path, d3.autoType),
        keyConcepts,
        dtypes
    });
  
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