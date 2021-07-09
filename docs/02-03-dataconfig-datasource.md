
# DATACONFIG (.data)
# Definition
A DataConfig describes which data the encoding encodes.

It points to a data `source` and describes what field (`concept`) and, if applicable, from what table `space` in the `source` the data comes and a `filter` defining a subset of rows. 

dataConfig is shorthanded to `.data` as `marker.data` and `encoding.data`.

# API reference
### Configurable Properties
Write through `dataConfig.config`, read through `dataConfig`.
- `dataConfig.source: DataSource|string`: DataSource to fetch data from.
  - If `encoding.data.source` is not set, it inherits `marker.data.source`.
- `dataConfig.space: Array<string>`: Which table in source to fetch data from. 
  - If `encoding.data.space` is not set, it inherits `marker.data.space`.
  - `marker.data.space` is also the space a `encoding.data.space` needs to include to define markers/rows in the output.  
- `dataConfig.locale: string`: Change locale/language in which data will be fetched for sources which support this. 
  - If `encoding.data.locale` is not set, it inherits `marker.data.locale` if set or else `encoding.data.source.locale`.
- `dataConfig.concept: string`: Data field to use for this encoding. Only used for `encoding.data`.
- `dataConfig.constant: any`: Constant value to use instead of data. Will be used instead of data when set. Only used for `encoding.data`.
- `dataConfig.filter: Filter`: A `Filter` object defining a subset of markers through dimension (property) values or keys.
  - If `encoding.data.filter` is not set, it inherits `marker.data.filter`.
- `dataConfig.allow: Object`: A condition by which certain concepts or spaces can be disallowed from being set in other fields. Exmple: `dataConfig.allow = {space: {filter: {concept_type: { $ne: "time" }}}}`
  
### Read only properties:
- `dataConfig.state`: Current loading state of the DataConfig. Should be `fulfilled` before reading any other properties.
- `dataConfig.configSolution`:
- `dataConfig.spaceCatalog`:
- `dataConfig.commonSpace`:
- `dataConfig.conceptProps`:
- `dataConfig.isConstant`:
- `dataConfig.availability`:

### Methods
- `dataConfig.isConceptAvailableInSpace(space, concept)`
- `dataConfig.createQuery({ space = this.space, concept = this.concept, filter = this.filter, locale = this.locale, source = this.source })`
  

# DATASOURCE (.source)
# Definition
DataSource is a wrapper around a vizabi reader. It broadens reader's API and adds features like response caching and nested availability.

Defines a source to fetch data from, which can be a file like csv or xls, a DDFCSV-dataset (a specially organised collection of csv files + datapackage.json), an onine database etc...  
During runtime vizabi can display data from multiple data sources and switch between them interactively. This is achieved by having multiple dataSource models defined in a "store", and then pointing the particular markers and encodings to the IDs of data sources in a store via setting a string value in `dataConfig.source`. The same field can also be set to a DataSource model.

dataSource is shorthanded to `.source` as `marker.data.source` and `encoding.data.source`.

# API Reference
### Configurable Properties
Write through `dataSource.config`, read through `dataConfig`. 
- `dataSource.modelType: string`: `ddfbw` | `cav` | `inline` | `ddfcsv` and any other reader that is implemented and added as model type to dataSourceStore
- `dataSource.locale: LocaleString`:  

Other properties depend on `dataSource.modelType` and the reader — the implementation of that model type
- `ddfbw`
  - `dataSource.service: string`: a remote URL where the requests are to be sent. Example: "https://big-waffle.gapminder.org"
  - `dataSource.name: string`: dataset name. Example: "sg-master"
- `ddfcsv`
  - `dataSource.path: string`: a path to a local or remote DDFCSV dataset. Example: "./data/ddf--jheeffer--mdtest"
- `csv`
  - `dataSource.path: string`: a path to a local or remote csv file. Example: "./data/basic.csv"
  - `dataSource.sheet: string`: name of a sheet in google spreadsheets, only applicable if `dataSource.path` contains "https://docs.google.com/spreadsheets/". Example: "Sheet1"
  - `dataSource.keyConcepts: Array<string>`: headers of columns that are to be treated as a key. Example: ["geo", "year"].
- `inline`
  - `dataSource.values: Array<Object>`
- `...`
  - one can define more model types (readers)

### Read only  Properties
- `dataSource.state`: Current loading state of the DataSource. Should be `fulfilled` before reading any other properties. 
- `dataSource.id`: Returns the id as defined in config, such as "mydata"
- `dataSource.availability`: 

### Methods
- `dataSource.query(Query)`: 