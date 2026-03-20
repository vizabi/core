# Vizabi Core — Comprehensive Technical Reference

> **@vizabi/core v1.37.2** — A reactive data layer that turns configuration and data into tidy, visualisation-ready tables.

Vizabi Core is *not* a chart library. It is the model layer that underpins every Vizabi chart tool (bubblechart, linechart, mountainchart, barrank, etc.). You give it a declarative config and one or more data sources; it gives you a fully joined, filtered, interpolated, animated `DataFrame` — a Map-based tabular structure — ready for rendering.

## Table of contents

1. [Key ideas and terminology](#1-key-ideas-and-terminology)
2. [Architecture overview](#2-architecture-overview)
3. [Configuration system](#3-configuration-system)
4. [DataSource and readers](#4-datasource-and-readers)
5. [DataFrame](#5-dataframe)
6. [Marker — the orchestrator](#6-marker--the-orchestrator)
7. [Encodings](#7-encodings)
8. [DataConfig and autoconfig](#8-dataconfig-and-autoconfig)
9. [Scale](#9-scale)
10. [Filter](#10-filter)
11. [Palette](#11-palette)
12. [API quick-reference](#12-api-quick-reference)
13. [Design decisions and tradeoffs](#13-design-decisions-and-tradeoffs)

---

## 1. Key ideas and terminology

### Grammar of Graphics heritage

Vizabi Core's design is inspired by the *Grammar of Graphics* (Wilkinson, 2005) — the same lineage as ggplot2, Vega-Lite, and Observable Plot. A visualisation is decomposed into:

| Grammar term | Vizabi term | Role |
|---|---|---|
| Data | **DataSource** + **DataConfig** | Where data comes from and how to query it |
| Aesthetic | **Encoding** | Maps a data concept to a visual channel (x, y, size, color…) |
| Mark | **Marker** | The thing being drawn (one bubble, one line, one bar) |
| Scale | **Scale** | Maps data domain → visual range |
| Facet | **Repeat** encoding | Small multiples via row/column aliases |
| Filter | **Filter** | Subsets data by markers or dimensional predicates |

### Data model — multidimensional by default

Unlike most charting libraries where data is a flat array of objects, Vizabi thinks in **dimensions** (keys) and **measures/properties** (values). A single datapoint lives in a **space** — the set of dimensions that define it. For example, a datapoint with `space = ["geo", "time"]` says "this value is for a specific geography at a specific time."

- **Entity domain**: a top-level dimension like `geo` or `gender`.
- **Entity set**: a subset of a domain, like `country` ⊂ `geo`, marked with `is--country`.
- **Concept**: any column — dimensions are key concepts, everything else is a value concept.
- **Concept type**: `time | entity_domain | entity_set | measure | string | boolean`.
- **Availability**: the matrix of which concepts exist in which spaces in a data source.

### Reactivity

Every model in Vizabi Core is a **MobX 5 observable**. Config changes propagate automatically through the dependency graph — from config → DataConfig → query → response → DataFrame → Marker pipeline → output. There is no manual subscription wiring; MobX `computed` properties and `reaction` side-effects handle everything.

### Data flow in one sentence

**Config** → **DataConfig** resolves concept + space → **DataSource** fetches via reader → response becomes **DataFrame** → **Marker** joins all encoding DataFrames → applies transformation pipeline (aggregate, interpolate, filter, order, trails…) → produces `marker.dataMap` (the final tidy table).

---

## 2. Architecture overview

### Model hierarchy

```
Vizabi instance (vizabi.js)
├── config (observable, the single source of truth)
├── stores
│   ├── dataSourceStore   → DataSource models
│   ├── markerStore       → Marker models
│   ├── encodingStore     → Encoding models
│   ├── dataConfigStore   → DataConfig models
│   ├── scaleStore        → Scale models
│   └── filterStore       → Filter models
└── markers (created from config)
    ├── Marker "bubble"
    │   ├── data: DataConfig (space, concept, source, filter)
    │   └── encodings
    │       ├── x: Encoding { data: DataConfig, scale: Scale }
    │       ├── y: Encoding { data: DataConfig, scale: Scale }
    │       ├── size: Encoding { data: DataConfig, scale: Size }
    │       ├── color: Encoding { data: DataConfig, scale: Color, palette: Palette }
    │       ├── frame: Frame { data: DataConfig }
    │       ├── selected: Selection
    │       ├── highlighted: Selection
    │       └── trail: Trail
    └── Marker "legend"
        └── …
```

### Package dependencies

- **mobx ^5.15.7** — reactivity (observable, computed, action, reaction, fromPromise)
- **d3 ^6.7.0** — scales, interpolation, color, parsing, fetching

### Source layout

```
src/
├── core/
│   ├── vizabi.js              ← factory: creates instance from config
│   ├── config.js              ← resolveRef(), reference transforms
│   ├── configurable.js        ← applyConfig() mixin (deepmerge into observable)
│   ├── genericStore.js        ← createStore() factory for all model stores
│   ├── utils.js               ← createModel(), deepmerge, combineStates, etc.
│   ├── ddfquerytransform.js   ← dotToJoin(), addExplicitAnd()
│   ├── palette.js             ← palette model (continuous/ordinal/constant)
│   ├── marker/                ← Marker, encodingCache, markerStore
│   ├── encoding/              ← Encoding base + 8 subtypes + encodingStore
│   ├── dataConfig/            ← DataConfig, configSolver, 2 variants + store
│   ├── dataSource/            ← DataSource, cache, dataSourceStore
│   ├── scale/                 ← Scale base + color + size + scaleStore
│   └── filter/                ← Filter, trailFilter, filterStore
└── dataframe/
    ├── dataFrame.js           ← DataFrame factory
    ├── dataFrameGroup.js      ← DataFrameGroup / DataFrameMultiGroup
    ├── dfutils.js             ← createKeyFn, arrayEquals, intersect, curry…
    ├── storage/               ← MapStorage, LookupStorage
    ├── info/                  ← extent(), unique()
    └── transforms/            ← 15 transform modules
```

### Model creation flow

Every model (Marker, Encoding, DataConfig, DataSource, Scale, Filter) follows the same lifecycle:

1. **Factory function** — e.g. `marker(config, parent)` — calls `createModel()`.
2. **`createModel()`** calls `type.nonObservable(config, parent)` → returns a plain object with getters, methods, defaults, `onCreate`, `dispose`.
3. The plain object is turned into an **observable MobX proxy** with decorated properties (`computed`, `computed.struct`, `action`, `observable.ref`...).
4. **`onCreate()`** runs — sets up reactions, defaults, etc.
5. The model is registered in its **store** (`markerStore`, `encodingStore`, etc.).
6. On teardown, **`dispose()`** cleans up reactions.

### Store pattern

`createStore(baseType, extendedTypes)` produces a store (observable Map of models) with:

- `create(config, parent)` → creates model of appropriate type
- `get(id, parent)` → getOrCreate semantics
- `set(id, model)` → register
- `has(id)` → check existence
- `dispose(model)` / `disposeAll()` → teardown

Extended types allow polymorphism: `scaleStore = createStore(scale, { color, size })`. The `modelType` config property selects which constructor to use.

---

## 3. Configuration system

### Config structure

A Vizabi config is a single nested object. At the top level it declares markers and data sources:

```js
{
  markers: {
    bubble: {
      modelType: "marker",
      data: {
        source: "sg",              // reference to a dataSource
        space: ["geo", "time"],
        filter: { markers: ["swe", "nor"] }
      },
      encoding: {
        x: { data: { concept: "gdp_per_cap" }, scale: { type: "log" } },
        y: { data: { concept: "life_expectancy" } },
        size: { data: { concept: "population" }, scale: { modelType: "size" } },
        color: { data: { concept: "world_4region" }, scale: { modelType: "color" } },
        frame: { modelType: "frame", data: { concept: "time" } },
        selected: { modelType: "selection" },
        trail: { modelType: "trail" }
      }
    }
  },
  dataSources: {
    sg: { modelType: "ddfbw", path: "sg-master" }
  }
}
```

### Config references (`resolveRef`)

Any config value can be a **reference** to another part of the config tree:

```js
{ data: { concept: { ref: "markers.bubble.encoding.x.data.concept" } } }
```

`resolveRef(configNode)` walks the config tree and returns `{ value, config }`. There are three reference transforms that modify the resolved value:

| Transform | Purpose |
|---|---|
| `entityConcept` | Resolves to the entity domain of the referenced concept |
| `entityConceptSkipFilter` | Same but used to skip filter application |
| `orderDirection` | Resolves to scale direction of the referenced encoding |

### `configurable` mixin

All models mix in `configurable`, which gives them `applyConfig(patch)` — an MobX action that deepmerges a partial config patch into the model's observable config.

### `deepmerge(target, source)`

Custom deep merge that:
- Overwrites arrays (doesn't concatenate)
- Handles `null` overwrites correctly
- Preserves MobX observability
- Is used both in `applyConfig` and in model creation

---

## 4. DataSource and readers

### What a DataSource does

A DataSource wraps a **reader** (the thing that actually loads data) and provides:

1. **Availability** — which concept × space combinations exist
2. **Concepts** — metadata about every concept (name, type, color palette, scales, etc.)
3. **Query interface** — send a DDFQL-like query, get a DataFrame back
4. **Drillup/drilldown catalog** — entity hierarchy navigation

### Default config

```js
{
  path: null,          // file path (CSV) or service path
  sheet: null,         // spreadsheet sheet name
  keyConcepts: null,   // explicit concept definitions
  values: null,        // inline data array
  dtypes: null,        // explicit type map { field: "time" | "number" | ... }
  locale: null,        // locale for translations
  transforms: []       // data transforms
}
```

### Built-in readers

| Reader | Trigger | Capabilities |
|---|---|---|
| **inlineReader** | `config.values` is set | Full DDFQL query support on in-memory arrays |
| **csvReader** | `config.path` is set | Auto-delimiter detection, Google Sheets URLs, time-in-columns pivot, auto-typing |

External readers (registered at runtime via `dataSourceStore.createAndAddType()`):

| Reader | Package | Notes |
|---|---|---|
| **ddfcsv** | `@vizabi/reader-ddfcsv` | Reads DDF-CSV datasets from filesystem or URL |
| **ddfbw** | `@vizabi/reader-ddfservice` | Queries Gapminder's Big Waffle API (fast, hosted service) |
| **excel** | `@vizabi/reader-excel` | Reads .xlsx files |
| **spreadsheet** | `@vizabi/reader-ddfservice` | Spreadsheet variant |

### Availability system

When a DataSource loads, it fetches **schema** collections for concepts, entities, and datapoints. These describe what data is available:

```
availability.keyValueLookup    // Map<keyStr, Map<concept, true>>
availability.keyLookup         // Map<keyStr, string[]>  (key string → key array)
availability.valueLookup       // Map<concept, Set<keyStr>>
availability.data              // Array of { key, value } rows
```

This is the foundation for **autoconfig** — the system that automatically figures out which concept to show on which axis.

### Concept metadata

After availability loads, DataSource fetches concept definitions. For each concept:

```js
{
  concept: "gdp_per_cap",
  concept_type: "measure",
  name: "GDP per capita",
  scales: '["log", "linear"]',    // JSON string of allowed scale types
  color: '{"palette": {...}}',     // JSON string of color config
  domain: "geo",                   // for entity_sets: parent domain
  drill_up: "world_4region",       // for drillup navigation
  tags: "..."
}
```

### Query pipeline

```
marker/encoding calls dataConfig.responsePromise
  → dataConfig.fetchResponse()
    → dataConfig.createQuery()        // builds DDFQL {select, from, where, language}
    → dataSource.query(ddfQuery)
      → dotToJoin(query)              // "geo.name" → join syntax
      → addExplicitAnd(query)         // implicit AND → explicit $and
      → combineAndSendQueries(query)
        → check cache (split by value key)
        → queue for batching (sleep → combine)
        → reader.read(query)
        → normalizeResponse()         // → { raw, forKey(k) → DataFrame }
    → response.forKey(commonSpace)    // rekey to intersection of encoding space and marker space
```

### Query batching and caching

Queries with the same key + filter but different values are **combined** — if you request `population` and `gdp_per_cap` for the same space/filter simultaneously, they become one query with `select.value: ["population", "gdp_per_cap"]`.

The **cache** stores results keyed by query signature. Multi-value query results are also split and cached as individual single-value queries, so a later request for just `population` can be served from cache without re-fetching.

### Drillup / Drilldown

DataSource builds a **drillup catalog** from concepts that have `drill_up` metadata. This enables navigating entity hierarchies:

- `drilldown({ dim: "geo", entity: "europe" })` → `{ country: ["swe", "nor", "fin", ...] }`
- `drillup({ dim: "geo", entity: "swe" })` → `{ world_4region: "europe", ... }`

---

## 5. DataFrame

DataFrame is the core data structure — a Map-based tabular container with chainable transforms.

### Creating DataFrames

```js
// From array
const df = DataFrame([
  { geo: "swe", time: 2020, pop: 10.4 },
  { geo: "nor", time: 2020, pop: 5.4 }
], ["geo", "time"])

// From lookup tables (virtual/generated, no storage)
DataFrame.fromLookups(new Map([["name", new Map([["geo", new Map([["swe", "Sweden"]])]])]]), ["geo"])
```

### Storage backends

| Backend | Used when | Characteristics |
|---|---|---|
| **MapStorage** | Default (`DataFrame()`) | JS Map keyed by string. O(1) get/set/has. Full iteration. |
| **LookupStorage** | `DataFrame.fromLookups()` | Virtual — generates rows on-demand from lookup tables. Read-only. No iteration. |

### Key system

Every row has a **key** — the set of dimension fields that uniquely identify it. The key is encoded as a string using the `¬` separator (e.g., `"swe¬2020"`) and cached on the row object via `Symbol.for('key')`.

`createKeyFn(space)` returns a micro-optimized function that extracts key values from a row and joins them with the separator.

### Map-like interface

```js
df.has({ geo: "swe", time: 2020 })   // → true
df.get({ geo: "swe", time: 2020 })   // → row object
df.getByStr("swe¬2020")              // → same row, faster
df.set(newRow)                        // → adds/updates
df.size                               // → number of rows
df.values()                           // → row iterator
df.keys()                             // → key string iterator
df.entries()                          // → [keyStr, row] iterator
```

### Transforms (chainable)

All transforms return a DataFrame (modified in-place or new):

| Transform | Signature | Mutates? | Description |
|---|---|---|---|
| `filter` | `(filterSpec)` | No | Subset rows by predicate or DDFQL WHERE syntax |
| `filterNullish` | `(fields)` | No | Remove rows with null/undefined in specified fields |
| `order` | `(order_by)` | No | Sort by fields with direction (`"asc"`, `"desc"`, or custom array order) |
| `fullJoin` | `(joinParams, joinKey)` | No | Full outer join of multiple DataFrames |
| `leftJoin` | `(rights)` | No | Left join, preserving left rows |
| `project` | `(projection)` | No | Select/rename columns |
| `addColumn` | `(name, value)` | **Yes** | Add or overwrite column (value can be function) |
| `copyColumn` | `(src, dest)` | **Yes** | Duplicate a column |
| `fillNull` | `(fillValues)` | **Yes** | Replace nulls with constants or computed values |
| `interpolate` | `(fields, interpolators)` | **Yes** | Linear interpolation within gaps in sorted data |
| `interpolateTowards` | `(df2, mu, fields, interpolators)` | No | Transition between two DataFrames (0→1) |
| `reindex` | `(iterable)` | No | Reorder by key sequence, fill missing with nulls |
| `differentiate` | `(xField)` | **Yes** | Replace values with deltas vs. previous row |
| `groupBy` | `(groupKey, memberKey)` | No | Create DataFrameGroup |
| `groupByWithMultiGroupMembership` | `(groupKey, memberKey)` | No | Groups where rows belong to multiple groups |
| `copy` | `()` | No | Shallow copy |

### Info methods

```js
df.extent("pop")                 // → [5.4, 10.4]
df.extent("pop", "geo")          // → { swe: [10.4, 10.4], nor: [5.4, 5.4] }
df.unique("geo")                 // → ["swe", "nor"]
```

### DataFrameGroup

A group is a Map of DataFrames (or nested Groups) keyed by a dimension:

```js
const group = df.groupBy("time")
// group.get("2020") → DataFrame with rows for that year

// Nested:
const nested = df.groupBy("time").groupBy("geo")
```

**Group-level transforms** propagate to all members: `group.filter()`, `group.order()`, `group.interpolate()`, `group.extrapolate()`.

**Cross-member operations**:
- `interpolateOverMembers()` — fill data gaps *between* groups (frames)
- `extrapolateOverMembers()` — extend data beyond the last known frame
- `flatten(key)` — merge all groups back into one DataFrame
- `reindexToKeyDomain(intervalSize)` — fill gaps in the key range with empty groups

### DDFQL filter syntax

The `filter` transform accepts DDFQL-style predicates that compile to JavaScript functions:

```js
df.filter({ geo: "swe" })                        // implicit $eq
df.filter({ pop: { $gt: 1000000 } })             // comparison
df.filter({ year: { $in: [2000, 2010, 2020] } }) // set membership
df.filter({ $and: [{ geo: "swe" }, { year: { $gte: 2000 } }] })
df.filter({ $or: [{ geo: "swe" }, { geo: "nor" }] })
```

Available operators: `$eq`, `$ne`, `$gt`, `$gte`, `$lt`, `$lte`, `$in`, `$nin`, `$and`, `$or`, `$not`, `$nor`.

### Symbol-based metadata (provenance tracking)

Rows carry provenance metadata as Symbols, invisible to normal iteration:

| Symbol | Meaning | Example value |
|---|---|---|
| `Symbol.for('key')` | Cached key string | `"swe¬2020"` |
| `Symbol.for('interpolated')` | Which fields were interpolated and from where | `{ pop: [row2015, row2025] }` |
| `Symbol.for('extrapolated')` | Which fields were extrapolated and from where | `{ pop: rowObj }` |

---

## 6. Marker — the orchestrator

### What a Marker does

A Marker is the central model. It:

1. Creates and manages its **encodings** (x, y, size, color, frame, selected, trail…)
2. Joins all encoding data into a single **dataMapCache** (the full-join table)
3. Applies a chain of **transformations** to produce the final **dataMap**
4. Combines state from all components and reports readiness

### Encoding classification

At creation, each encoding is classified into one of four roles:

| Role | Meaning | Join strategy | Examples |
|---|---|---|---|
| **Defining** | Has its own data query, provides join keys | Full join | x, y, size |
| **Ammend via getter** | Amends rows through lazy property getters | `Object.defineProperty` | color (category lookups) |
| **Ammend via write** | Eagerly writes values during cache build | Iterate + set | label-like encodings |
| **No-op** | No data to contribute | Skip | frame, selected, trail |

The classification depends on the encoding's `data.hasOwnData`, `data.conceptInSpace`, storage type, and whether the concept is in the marker space.

### dataMapCache — the full-join table

```
ammendFnForEncoding()  → classify each encoding
  ↓
dataMapCache = fullJoin of all "defining" encodings
  → then: addColumn via getters for "ammendGet" encodings
  → then: iterate and write for "ammendWrite" encodings
```

This produces a single DataFrame keyed by the marker's space, with columns for every encoding's concept.

### Transformation pipeline

The marker maintains a chain of **boxed computeds** — each step observes only the previous step's output, creating a fine-grained dependency graph:

```
dataMapCache (the raw joined data)
  → aggregate        (group dimensions by configurable sizes, sum measures)
  → frameMap         (groupBy frame concept → DataFrameGroup of frames)
  → interpolate      (fill gaps within each frame)
  → extrapolate      (extend data beyond known range for trails)
  → filterRequired   (remove rows with null required fields)
  → fillRequiredFields (fill missing fields for specific use cases)
  → addPreviousTrailHeads (insert historical positions for trail start)
  → order            (sort by order encoding)
  → orderFacets      (sort within faceted groups)
  → addTrack(x)      (cumulative x positioning for stacked layouts)
  → addTrack(y)      (cumulative y positioning)
  → addTrails        (insert trail datapoints for selected entities)
  → currentFrame     (extract current frame from frameMap → flat DataFrame)
```

Each step is wrapped in a **boxed computed** (`computed(() => box.set(transform(prevBox.get())))`) so that:
- Only affected steps recompute when upstream changes
- Individual steps can be accessed by name: `marker.transformedDataMaps.get("interpolate").get()`

### Final output

```js
marker.dataMap          // → the final DataFrame after all transforms
marker.dataArray        // → [...marker.dataMap.values()]  (array of row objects)
```

### State management

Marker state combines all sub-model states sequentially:

```
state = combineStatesSequential([
  referenceState,              // config reference resolution
  configState,                 // autoconfig solving
  ...encoding states           // each encoding's data fetch state
])
```

Possible states: `"pending"`, `"fulfilled"`, `"rejected"`. The transformation pipeline only runs when state reaches `"fulfilled"`.

### Important marker properties

| Property | Type | Description |
|---|---|---|
| `data` | DataConfig | The marker's own DataConfig (defines space, source, filter) |
| `encoding` | Object | Map of encoding name → Encoding model |
| `dataMap` | DataFrame | Final output after all transforms |
| `dataArray` | Array | `[...dataMap.values()]` |
| `transformedDataMaps` | Map | Named access to intermediate pipeline stages |
| `state` | String | Combined state of all sub-models |
| `type` | String | `"marker"` |

---

## 7. Encodings

### Base encoding (`encoding.js`)

Every encoding has:

```js
{
  data: DataConfig,     // what concept, space, source to fetch
  scale: Scale,         // how to map data domain → visual range
  state: String,        // combined data + scale readiness
}
```

Key methods:
- `setWhich(config)` — change what concept this encoding shows (triggers autoconfig)
- `transformationFns` — object of transform functions this encoding contributes to the marker pipeline
- `dispose()` — cleanup

### Encoding subtypes

#### Frame (`frame.js`)

The animation controller. Frame groups data by a time-like concept and controls playback.

**Key properties:**
- `frameMap` — DataFrameGroup keyed by frame values (e.g., years)
- `currentFrame` — the DataFrame for the current time step
- `value` / `speed` / `loop` / `playing` — animation state
- `stepScale` — d3 scale mapping frame values to step indices (for slider)
- `splash` — reduced-resolution "preview" marker for initial loading

**Transformation contributions:**
```
frameMap       → groupBy(frameConcept)
interpolate    → interpolateOverMembers on the group
extrapolate    → extrapolateOverMembers on the group  
currentFrame   → interpolateBetween(frame[i], frame[i+1], mu) for smooth animation
```

#### Selection (`selection.js`)

Minimal encoding — stores selected markers. Sets `concept: undefined`, `space: undefined` (no data to fetch, no autoconfig).

#### Trail (`trail.js`)

Historical paths for selected entities. Controlled by `starts` (Map of marker → start frame) and `limits` (computed start/end per marker).

**Transformation contributions:**
```
addPreviousTrailHeads  → copies previous frame's data for trail start points
addTrails              → inserts trail rows from frameMap history
```

#### Aggregate (`aggregate.js`)

Groups dimensions by configurable bin sizes and sums measures.

**Aggregation config:**
```js
{ aggregate: { dim1: 20, dim2: 10 } }   // group dim1 into 20 bins, dim2 into 10
```

#### Order (`order.js`)

Sorts the DataFrame by this encoding's concept value, with configurable direction.

**Transformation contributions:**
```
order       → sort by concept with direction (asc/desc)
orderFacets → sort within faceted groups
addTrack(x) → cumulative sum for stacked positioning
addTrack(y) → same for y-axis
```

Uses `data.order_direction` (or auto-detected from concept's `order` scale property via config reference transforms).

#### Lane (`lane.js`)

Assigns vertical track positions based on ranked concept entities. Uses padding ratio 0.1 between lanes.

#### Repeat (`repeat.js`)

Enables small multiples (faceting). Defines `row` and `column` aliases that map to actual encoding names:

```js
{
  modelType: "repeat",
  row: ["y1", "y2"],
  column: ["x1"],
  aliases: { y1: "gdp", y2: "pop", x1: "time" }
}
```

Generates `ncolumns × nrows` facets, each resolving to specific encoding concepts.

### Encoding registration

All encoding types are registered in `encodingStore`:

```js
encodingStore = createStore(encoding, {
  frame, selection, trail, aggregate, order, lane, repeat
})
```

The `modelType` config property determines which subtype is instantiated.

---

## 8. DataConfig and autoconfig

### What DataConfig does

DataConfig answers: "What concept, from what space, from what source?" for a given encoding. It:

1. **Resolves** source, space, concept, filter, locale (with parent fallback)
2. **Autoconfigures** missing space and/or concept via the **configSolver**
3. **Builds and sends** the DDFQL query
4. **Returns** the response as a DataFrame

### Resolution with parent fallback

When an encoding's DataConfig doesn't specify `source` or `locale`, it falls back to the parent marker's DataConfig:

```
encoding.data.source → resolveRef → if null → marker.data.source
encoding.data.locale → resolveRef → if null → marker.data.locale
```

### Key computed properties

| Property | Description |
|---|---|
| `source` | DataSource model (resolved or inherited) |
| `space` | Array of dimension concept IDs |
| `concept` | The value concept ID |
| `filter` | Filter model |
| `locale` | Locale string for translations |
| `constant` | A fixed value (if encoding shows a constant, not data) |
| `hasOwnData` | `true` if source + concept exist and concept is not in space |
| `conceptInSpace` | `true` if the concept is one of the dimensions |
| `commonSpace` | Intersection of encoding space and marker space |
| `domain` | `[min, max]` for continuous or `[unique values]` for discrete |
| `conceptProps` | Full concept metadata object from DataSource |
| `response` | The fetched DataFrame |
| `state` | Sequential: configState → source.conceptsState → responseState |

### Query construction

```js
dataConfig.ddfQuery → {
  select: { key: space, value: [concept] },
  from: space.length === 1 ? "entities" : "datapoints",
  where: combinedFilter.whereClause(space),
  language: locale
}
```

The `from` field is determined by dimensionality: 1D data is entity metadata, 2D+ is datapoints.

### configSolver — the autoconfig system

When a DataConfig's `space` or `concept` is an object (not a literal array/string), the solver autoconfigures it.

#### Solving order

1. **Marker-level** — `markerSolution(markerDataConfig)`:
   - Determines the marker space (if not explicit)
   - For each encoding, determines its concept

2. **Space solving** — `autoConfigSpace()`:
   - Gets available spaces from DataSource availability
   - Sorts: 2D+ first (ascending size), then 1D
   - Filters by config constraints and `allow.space.filter`
   - Tests each space by attempting to solve all encodings within it

3. **Concept solving** — `findConceptForSpace()`:
   - Gets available concepts for the space from availability
   - Filters out `is--` prefixed concepts
   - Applies `allow.concept.filter`
   - Uses `selectMethod` (default: `selectUnusedConcept`) to pick

4. **Loopback** — once solved, a reaction writes the solution back to config:
   ```js
   reaction(
     () => this.state == 'fulfilled' ? this.configSolution : {},
     ({ space, concept }) => { this.config.space = space; this.config.concept = concept; }
   )
   ```

#### Concept selection methods

| Method | Algorithm |
|---|---|
| `selectUnusedConcept` (default) | First concept not already used by another encoding |
| `mostCommonDimensionProperty` | Most common property across all entities in space (for `entityPropertyDataConfig`) |

#### The `allow` constraint

DataConfig exposes an `allow` object that can restrict autoconfig:

```js
allow: {
  space: { filter: (space) => boolean },    // which spaces are valid
  concept: { filter: (concept) => boolean } // which concepts are valid
}
```

### DataConfig variants

| Variant | Purpose | Difference from base |
|---|---|---|
| `entityMembershipDataConfig` | Fetches "isness" membership | Custom `fetchResponse()` that builds isness arrays from spaceCatalog |
| `entityPropertyDataConfig` | Fetches entity display names | Fetches per-dimension, merges into lookup DataFrame. Uses `mostCommonDimensionProperty` solver. |

---

## 9. Scale

### What a Scale does

A Scale maps a data **domain** (concept values) to a visual **range** (pixels, colors, sizes). It wraps d3 scales with Vizabi-specific features: autoconfig of scale type, zooming, zero-baseline, clamping.

### Scale types

| Type | d3 function | Category | Notes |
|---|---|---|---|
| `linear` | `scaleLinear` | numeric | Default for measures |
| `log` | `scaleLog` | numeric | Auto-converts to `genericLog` if domain crosses zero |
| `genericLog` | `scaleSymlog` | numeric | Handles positive and negative values |
| `sqrt` | `scaleSqrt` | numeric | Square root scale |
| `time` | `scaleUtc` | numeric | UTC time scale |
| `ordinal` | `scaleOrdinal` | categorical | Default for entity_domain/entity_set |
| `point` | `scalePoint` | categorical | For size encoding categories |
| `band` | `scaleBand` | categorical | Banded positioning |
| `rank` | `scaleLinear` | categorical | Ordinal data → rank position |
| `svg` | `scaleIdentity` | categorical | Pass-through |

### Scale type resolution

Priority:
1. Explicit `config.type`
2. Concept's `scales` JSON metadata property
3. `"time"` if concept_type is "time"
4. Categorical type if constant / entity / string / boolean
5. Numeric type (default: `"linear"`)

### Domain computation

Priority:
1. Explicit `config.domain` (with optional clamping to data)
2. Constant value → `[value]`
3. Same concept as frame encoding → borrow frame scale domain
4. Rank type → `[0, totalTrackNumber]`
5. Data-derived domain (from `data.domain`) with optional **zero-baseline**
6. Default `[0, 1]`

**Zero-baseline**: When enabled and the domain is one-sided (all ≥ 0 or all ≤ 0), the value closest to zero is replaced with zero. Used for bar charts and bubble sizes.

### Zooming

`scale.zoomed` returns a temporary zoom domain that can differ from the data domain. Two mechanisms:

1. **Direct zoom**: `config.zoomed = [min, max]`
2. **Borrowed zoom** (color scale): borrows zoom state from a matched encoding (e.g., borrow x-axis zoom for color gradient)

### Color scale (`color.js`)

Extends base Scale with:

- **Palette integration**: resolves palette from concept metadata or builtin defaults
- **Gamma-corrected RGB interpolation**: uses gamma 2.2 for perceptually uniform color blending
- **Zoom borrowing**: `matchEncsToBorrowZoom` + `borrowZoom` for syncing color zoom with an axis
- **Pattern detection**: recognizes SVG pattern references (values starting with `<`)
- **D3 scale creation**: maps palette domain percentages to actual domain values for continuous palettes

### Size scale (`size.js`)

Extends base Scale with:

- `extent: [0, 1]` — multiplier range (0% to 100% of configured range)
- `zeroBaseline: true` — default (bubble sizes should start from zero)
- Default range: `[0, 20]` pixels

### computed.struct decorators

Scale uses `computed.struct` for `domain`, `range`, and `zoomed` to prevent infinite loops. Without structural comparison, every recomputation would produce a "new" array (by reference), triggering downstream recomputation even when values are identical.

---

## 10. Filter

### Two filter modes

A filter can operate in two modes simultaneously:

#### 1. Marker-based filter (simple)

An array of selected marker keys:

```js
filter.config.markers = ["swe", "nor", "fin"]   // or with payload:
filter.config.markers = { swe: { trailStart: 1990 }, nor: {} }
```

API: `has(d)`, `set(marker, payload)`, `delete(marker)`, `toggle(marker)`, `clear()`, `any()`, `getPayload(d)`.

#### 2. Dimension-based filter (limited structure)

A MongoDB-like structure for filtering by entity hierarchies. This is the more complex mode, used to express "show all countries in Europe except…":

```js
filter.config.dimensions = {
  geo: {
    $or: [
      { "is--country": true, geo: { $in: ["swe", "nor", "fin"] } }
    ],
    $nor: [
      { "is--country": true, geo: { $in: ["dnk"] } }
    ]
  }
}
```

- `$or` — additive (whitelist): show these entities
- `$nor` — subtractive (blacklist): hide these entities
- Each entry can have an **isness marker** (`is--country`, `is--region`) identifying the entity hierarchy level

API:
- `addUsingLimitedStructure({ key, dim, prop, isness })` — add to whitelist
- `deleteUsingLimitedStructure({ key, dim, prop, isness })` — add to blacklist
- `switchIsenssUsingLimitedStructure({ dim, isness })` — change hierarchy level
- `clearFilterUsingLimitedStructure({ dim })` — clear dimension filter
- `isAlreadyAddedUsingLimitedStructure(...)` / `isAlreadyRemovedUsingLimitedStructure(...)`
- `findOutIsnessUsingLimitedStructure({ dim })` — detect current isness level

### Where clause generation

`filter.whereClause(space)` produces a MongoDB-like query from the current filter state:

```js
// With markers:
{ $or: [{ geo: "swe" }, { geo: "nor" }, { $and: [dimFilter1, dimFilter2] }] }

// Without markers (dimensions only):
merged dimension filters (implicit $and)
```

This where clause is what gets sent to readers as part of DDFQL queries.

### Trail filter (`trailfilter.js`)

Extends base Filter with value clamping. When setting a trail marker, the value is clamped to the trail's computed `limits` (start/end frame for that marker). This prevents trail animations from going beyond their data range.

---

## 11. Palette

### What a Palette does

A Palette maps categorical or continuous domain values to colors. It sits inside a Color scale and provides the actual color mapping.

### Palette types

| Type | Used when | Example |
|---|---|---|
| `_continuous` | Concept is measure or time | 5-stop gradient: purple → blue → green → gold → red |
| `_ordinal` | Concept is entity_set/entity_domain/string | 12 distinct colors |
| `_constant` | Encoding shows a fixed value | Single orange color |

### Resolution order

1. If concept metadata includes a `color.palette` property → use that
2. If constant value is a hex color → use that
3. Otherwise → use builtin based on `paletteType`
4. Merge user `config.palette` overrides on top

### Color shades

Palettes can define **shades** — darker/lighter variants for highlighting or deselecting:

```js
palette.getColorShade({ colorID: "swe", shadeID: "shade" })
// → applies d3 darker(0.5) transformation
```

### Color operations

- `setColor(value, pointer)` — set a palette entry (converts to hex)
- `removeColor(pointer)` — remove user override
- `getColor(key, palette)` / `getColorByIndex(index, palette)` — cycle through palette colors

---

## 12. API quick-reference

### Creating a Vizabi instance

```js
import Vizabi from "@vizabi/core"

const viz = Vizabi(config)
// viz is an observable config proxy
```

### Static factory shortcuts

```js
Vizabi.marker(config, parent)
Vizabi.encoding(config, parent)
Vizabi.dataSource(config, parent)
Vizabi.dataConfig(config, parent)
Vizabi.filter(config, parent)
Vizabi.scale(config, parent)
```

### Registering a custom reader

```js
import { dataSourceStore } from "@vizabi/core"

dataSourceStore.createAndAddType("myReader", {
  init(config) { /* setup */ },
  read(query) { /* returns promise of array */ },
  getDatasetInfo() { return { name: "..." } },
  getAsset(id) { /* returns promise */ },
  getDefaultEncoding() { /* optional */ }
})
```

### Stores

| Store | Base type | Extended types |
|---|---|---|
| `dataSourceStore` | `dataSource` | (runtime-registered readers) |
| `markerStore` | `marker` | — |
| `encodingStore` | `encoding` | `frame`, `selection`, `trail`, `aggregate`, `order`, `lane`, `repeat` |
| `dataConfigStore` | `dataConfig` | `entityMembershipDataConfig`, `entityPropertyDataConfig` |
| `scaleStore` | `scale` | `color`, `size` |
| `filterStore` | `filter` | `trailFilter` |

### DataFrame API

```js
import { DataFrame } from "@vizabi/core"

// Construction
DataFrame(arrayOfRows, keyFields)
DataFrame.fromLookups(conceptMap, keyFields)

// Transform chain
df.filter({ pop: { $gt: 1e6 } })
  .order([{ pop: "desc" }])
  .project(["geo", "pop"])

// Group & animate
df.groupBy("time")
  .interpolate()
  .extrapolate({ sizeLimit: 5 })

// Transition between two frames
df1.interpolateTowards(df2, 0.5, ["pop", "gdp"])
```

### Key utility functions

```js
import { createKeyFn, createKeyStr, arrayEquals, intersect, unique } from "@vizabi/core"

const keyFn = createKeyFn(["geo", "time"])  // returns optimized key generator
keyFn({ geo: "swe", time: 2020 })           // → "swe¬2020"
```

---

## 13. Design decisions and tradeoffs

### Why MobX 5 (not 6)?

MobX 5 uses ES6 Proxy-based observables. The codebase was built with MobX 5 idioms — in particular, `observable.shallow` for config objects and the `fromPromise` utility from mobx-utils. MobX 6 introduced breaking changes in decorator behavior and default observability. A migration would require touching every model.

### Why not a standard DataFrame library?

Vizabi's DataFrame is simpler than pandas/Arrow but tailor-made for the use case:
- **Map-based** for O(1) key lookup (critical for per-frame animation)
- **Key awareness** built into the data structure (not an index added later)
- **Symbol metadata** for tracking interpolation/extrapolation provenance
- **Composable transforms** that can be chained without materializing intermediates
- **Multi-group membership** for entity hierarchies (a country can belong to multiple regions)

### Why boxed computeds in the transformation pipeline?

Each step in the marker's transformation chain is a `computed(() => box.set(...))` wrapping a `computed(() => box.get())`. This is the "boxed computed" pattern. Without it, a change at the beginning (e.g., new data) would invalidate *every* downstream step simultaneously. With boxing, each step only recomputes when its *immediate predecessor* changes, and the new value is compared to the old before propagating further.

### Query batching with `sleep()`

When multiple DataConfigs fire simultaneously (e.g., on initial load), their queries arrive at the DataSource in the same microtask. Rather than sending each immediately, the DataSource queues them, sleeps (yields to the event loop), then combines compatible queries (same space + filter, different values) into a single request. This dramatically reduces network round-trips.

### The "limited structure" filter

Entity hierarchies in DDF have "isness" — a country `is--country: true`, and it may also `is--un_member: true`. The filter system needs to express "show all countries EXCEPT Denmark" or "show all UN members AND also add Sweden explicitly." The limited structure (`$or` / `$nor` with isness markers) handles this, but it's complex because:
- Subtractive and additive operations must coexist
- Changing hierarchy level (from countries to regions) requires updating all entries
- Cartesian permutations handle multi-dimensional filtering

### Why configSolver is eager

The configSolver runs on every DataConfig that has object-type (non-literal) `space` or `concept`. It tests spaces against availability *before* fetching data. This means a chart can auto-layout its encodings based on what data is actually available — you can drop a new dataset in and get a sensible default visualization without specifying every axis manually.

### Config loopback

After the solver determines the best space and concept, a `reaction` writes them back into the config. This seems circular but is intentional: it means the *config* always reflects the current state, even for auto-resolved values. If a user later exports the config, they get a complete, reproducible specification.

### Shallow observable config on DataSource

DataSource config uses `observable.shallow` rather than deep observability. This is because `config.values` (inline data) can be very large (thousands of rows). Making it deeply observable would create thousands of observable proxies for no benefit — the data is read-only once loaded.

### computed.struct for array properties

Scale uses `computed.struct` for `domain`, `range`, and `zoomed`. Without this, every recomputation of `domain` returns a "new" array `[0, 100]` that MobX sees as changed (by reference), triggering downstream recomputation even though the values are identical. `computed.struct` performs deep equality comparison on the result, preventing false invalidations.

### State combination: sequential vs. parallel

`combineStates([...fns])` — evaluates all state functions and returns the worst (pending > rejected > fulfilled).

`combineStatesSequential([...fns])` — evaluates state functions left-to-right, stopping at the first non-fulfilled. This is used when later states depend on earlier ones being resolved first (e.g., don't check response state until config is solved).

---

## Appendix: Reactive dependency graph

```
config  ─────────────────────────────────────────┐
  │                                               │
  ▼                                               ▼
dataSource.config ──► reader ──► availability ──► concepts
                                    │                │
                                    ▼                ▼
                              configSolver ◄──── dataConfig.configSolution
                                    │
                                    ▼
                              dataConfig.space, concept
                                    │
                                    ▼
                              dataConfig.ddfQuery
                                    │
                                    ▼
                              dataSource.query() ──► cache ──► reader.read()
                                    │
                                    ▼
                              dataConfig.response (DataFrame)
                                    │
                                    ▼
                              marker.dataMapCache (fullJoin of all encoding responses)
                                    │
                                    ▼
                              transformation pipeline (boxed computed chain)
                              aggregate → frameMap → interpolate → extrapolate
                              → filterRequired → order → addTrails → currentFrame
                                    │
                                    ▼
                              marker.dataMap (final output)
```
