# Encoding

An encoding is a combination of a data model and a scale model.

Encoding can get data from two sources. 

1. From their own predefined data sources.
2. From the markers build from other encodings

Selections should be able to select all markers in the visualization. Thus it should use the markers build from other encodings as data source.

However, we might want to make selections depend on properties as well (e.g. population > 10000). In that case, if this config is on marker, separate encodings might give back different markers because they have different datasources or different spaces.

## option 1

In that case, we want the selection be defined by one query to one dataset (or joining of multiple datasets). 

That would mean markers are defined in three steps:

1. Define marker subset to show.

   Definition is by criteria on marker keys.

   Three types of criteria:

   - Marker criterium. Specific marker key.
     These can be copied right away to other encoding queries.

   - Dimension criterium. Filter on dimension of marker. 
     These can be copied right away to other encoding queries.

   - Property criterium. Need to query to get dimension values for that property. 
     Those markers/dimension values are added to marker criterium.

2. Query full-space encodings with defined marker keys. Full join of results defines actual markers. Might be less than predefined marker keys because there might be no data for keys.

3. Query sub-space encodings with defined markers
   Subspace queries use domains of subspace dimensions in predefined markers.

## option 2

The other option would be that each encoding adds the property filter. If there's different data sources for encodings, they can return different markers because they have different properties (e.g. different population numbers).

Two steps for defining markers:

1. Query full space encodings which defines marker keys, using marker, dimension and property filter filters
2. Query sub-space encodings. If marker filter, use domain of markers. If dimension filter, apply relevant dimension filter. If property filter and property available, use property filter? Or skip property filter.