# Filter limited structure
This document outlines the design choices that go into filter.js LIMITED STRUCTURE. 
functions such as `addUsingLimitedStructure`, `deleteUsingLimitedStructure` etc

## Context
we have to show marks -- visual elements -- in charts, marks be multi-dimensional, which means each mark id identified by independent variables such as georgraphy+gender+age in a set of demographic pyramids for multiple countries

now, each of these dimensions my have its own filter. we should keep the multi-dimensionality in mind, but in practice all dimensions are easy except one, which is tricky

now we narrow down to just geography dimension, dim="geo" filter, which is the most common tricky one. geographies are multi-hierarchical: `continent --> country --> state --> county --> neighborhood` but also `landlocked/coastline --> country` and also `NATO/not NATO --> country`

we should keep the multi-hierarchy in mind, but in practice, users have their geographics in a single hierarchical chain such as `continent --> country --> state --> county --> neighborhood`

REQUIREMENT: keep both multidimensionality and multi-hierarchy in mind, while considering partial solutions to specific cases



## Problem
we want the filter to be
1. expressive, so instead of listing 3000 entities that should pass the filters we should group them into a simple criteria. the filters is shared as a URL state, so it has to fit!
2. possible to build with button-pressy tools instead of making users to write code or formulae. our target audience is non-computer people. while expressing filter with AND, OR, IN, NIN formula is great! DDF supports it, reader supports it, vizabi core supports it, we don't want to make users write such a formula, we want to support users directy clicking on visual elements and modifying a filter

our common use cases are:
* Add a geography not displayed currently, such as adding USA when mountain chart shows shapes for the 4 continents. 
* Add a group of geographies to the view, by some criteria along one of hierarchies: add all landlocked countries or add all states in India. 
* Explode a geography into subgeographies, along one of hierarchies, such as: explode USA into states. this involves removing USA from view and adding states into view. 
* Explode across multiple levels, for example explode USA to counties. 
* Switch level of representation, thus effectively exploding all geographies.

The features start being complicated when we combine them cases. We explode USA into counties but then fold one of the states, but then exclude other states.

All these operations need an inverse operation feature, such as exclude all Asian countries from view. All forward operations and all inverse operations need an UNDO feature, such as fold back after explosion or adding back Asian countries. UNDO and inverse operations should in theory be the same, but both cases needs to be verified.

The filter should return to the same shape after performing an operation and then undoing it (=runing an inverse operation)


### What the problem actually is

Most filter systems assume a **flat entity space**: you pick which rows to include. Vizabi's problem is different: the entity space is **hierarchical and the granularity itself is the variable**. You don't just filter "show me these kommuns" — you say "show regions everywhere, EXCEPT here show regsos, EXCEPT in this part show kommuns again." That's not a predicate over entities, it's a **patchwork of granularities**.


## How others approach it

**Tableau / Power BI** punt on it entirely. Drill-down navigates the whole view to a new level — it's not mixed-granularity, it's a full level switch. Simple, but you can't show Stockholm at regso level while showing Gothenburg as a single komun.

**GIS tools (QGIS, ArcGIS)** use separate layers — one layer per granularity, with visibility toggles. No mixing within a layer. Works visually but the filter logic is per-layer, not unified.

**Google BigQuery / dbt** model hierarchies as separate dimension tables and let you join at whatever grain you want. But that's query-time resolution, not interactive visual state.

**Observable Plot / Vega-Lite** leave it completely to the user — you write the predicate yourself. No built-in concept of "explode this node."

Nobody in the mainstream viz space has a clean interactive answer to mixed-granularity because it requires resolving **the URL/state encoding problem**: how do you compactly represent "everything at level X except these nodes which are at level Y"? The compact form `{ is--regso: true, komun: {$in: ["0162"]} }` is elegant precisely because it exploits the fact that every entity carries ancestor keys — that's the key insight that makes the $or/$nor structure work at all.


## Partial solution: "Limited structure"
let's limit the structure of the filter that covers most of our use cases and create a user interface that manipulates such limited structure

we define two sections in a filter per dimension: Additve "$or" and substractive "$nor".
sections are joined via implicit "$and".

inside each section we list cases that should pass the filter or be excluded.
in each case we set the isness level.

technically nothing stops us from using the same isness in multiple cases, but we say each level appears only once! this makes it easier.

each case can be gated by a property, specified as "$in" array.
for simplicity let's further restrict that each case only has up to one property gate.

the below filter would result in showing one mark for the world, one bubble for american continents and one mark for each christian country, except for countries in american continents
notice how this says add geo="americas" but remove all where world_4region="americas" in order to add a continent entity but exclude all countries in that continent, thus folding american countries into the continent

```json
  { 
    "dimensions": {
      "geo": {
      // additive section
      "$or": [{ 
        "is--global": true 
      },{ 
        "is--worl4region": true, 
        "geo": { "$in": ["americas"] } 
      },{ 
        "is--country": true, 
        "main_religion": { "$in": ["christian"] } 
      }],
      // substractive section
      "$nor": [{
        "is--country": true,
        "worl4region": {"$in": ["americas"]} 
      }]
    }, 
    "markers": [] 
  }
```

## API
to manipilate the limited structure we need to specify the following params:
* what is the type operation: adding or substracting?
* what is the isness?
* what is the propery gate id? 
* what are the items in the property gate? 

the last two are optional but must always appear together

this would allow us to make features such as exploding and folding entities
excluding a group, adding a group etc

## What is isness?
Boolean entity property that matches the entity_set id with an added `is--` prefix to tell us which entity set(s) an entity belongs to. 
In the DDF dataset Stockholm would have is--city=TRUE, is--country=FALSE, but Singapore would have is--city=TRUE, is--country=TRUE

## Reader Limitation
if prop gate matches isness, we must replace it with generic id of our dimension,
because reader can't handle situations like `{is--region:true, region: {$in: [asia]}}`
so instead we write `{is--region:true, geo: {$in: [asia]}}`

## Explode and Fold — compact form is always correct

### Key assumption: fully-connected hierarchy
Every entity in the hierarchy carries the full chain of ancestor properties.
A RegSO knows its Kommun. A Kommun knows its Region. A Region knows Sverige.
There are no orphaned branches anywhere in the chain.
This holds true for all datasets in use; it is a prerequisite for the limited structure to work.

### The compact explode form
When exploding entity X (of type `prop`) into entities of type `explodeProp`, the correct filter change is always:

```
add:    { is--<explodeProp>: true, <prop>: { $in: [X] } }   // all explodeProp-entities whose prop = X
delete: { is--<prop>: true,       <prop>: { $in: [X] } }   // remove X itself
```

This works whether:
- explodeProp is the immediate next level (single-step): komun → regso
- explodeProp skips levels (cross-level): region → regso bypassing komun

Because regso entities carry `komun` AND `region` as properties, gating on either is equally valid.
The gate prop is always `d.prop` (the level of the clicked entity), not some intermediate level's prop.

### Why the old `!prevProp` branch was wrong
The old code used `prevProp` (whether this entity type is first in the drilldown config) as a proxy
for "do I need to enumerate children explicitly?". It assumed top-of-config entities needed child
enumeration to build the gate, falling back to listing all intermediate-level child IDs.

This was incorrect for two reasons:
1. The signal (`!prevProp`) detects config position, not data topology
2. Given the fully-connected assumption, the compact form always works — child enumeration
   is never necessary and produces bloated, brittle URL state

The fix: remove the `!prevProp` branch entirely. Use the compact form unconditionally.

### Complex scenario: mix of explodes and folds stays clean
Example with Sverige → region → komun → regso, starting from `{ is--komun: true }`:

**Explode Malmö komun to regso:**
```
$or:  { is--komun: true }
      { is--regso: true, geo: { $in: ["malmo"] } }
$nor: { is--komun: true, geo: { $in: ["malmo"] } }
```

**Then fold some of those regsos back to a komun:**
```
$or:  { is--komun: true }
      { is--regso: true, geo: { $in: ["malmo"] } }
      { is--komun: true, geo: { $in: ["malmo_centrum"] } }   ← added
$nor: { is--komun: true, geo: { $in: ["malmo"] } }
      { is--regso: true, geo: { $in: ["malmo_centrum"] } }   ← subtracted
```

Round-trips correctly: undoing each operation restores the previous state exactly.
The one-isness-per-section constraint is satisfied as long as all entities at the same level
are gated by the same prop — which holds in a linear chain hierarchy.

### Intermediate level removal during explode

When exploding entity X (of level `prop`) to `explodeProp`, the filter must also remove every
intermediate level between `prop` and `explodeProp` that is currently active. Example:

- Base filter: `{ is--komun: true }` (all kommuns shown)
- User explodes Stockholm region (prop="region") to regso
- Just adding regsos and removing `is--region` is not enough — the kommuns of that region
  remain visible because `{ is--komun: true }` still passes them through
- The correct additional operation: `delete({isness: "is--komun", prop: "region", key: regionKey})`
  → creates `$nor: { is--komun: true, region: { $in: [regionKey] } }` → kommuns disappear ✓

IMPORTANT: only fire intermediate deletes for levels that ARE currently active in the filter
(check `findOutIsnessUsingLimitedStructure` before the runInAction). This prevents creating
stale `$nor` entries for levels that aren't shown, which would break round-trip correctness.

For example, exploding from `{ is--region: true }` (no kommuns in filter):
- `is--komun` is NOT in currentIsnesses → skip the komun delete
- Result is clean; fold-back restores the exact original state





## Is the limited structure approach reasonable?

**What's good:**
- The compact form is genuinely minimal — one clause per exploded node regardless of how many children it has
- It's URL-serializable and survives page reload
- The $or/$nor split maps cleanly onto "show these" / "hide these" semantics that readers already understand
- It composes: multiple independent explodes just add clauses, they don't interfere

**What's fragile:**
- The **AND semantics of $nor** create the blocking problem you spent days debugging — the structure can't express "exclude all of A except B" without enumeration, which breaks the compactness guarantee in the fold-within-ancestor case
- The **reader limitation** (prop→dim rename) is a leaky abstraction — it's a workaround for a backend constraint that bleeds into the client-side filter logic everywhere
- The **implicit dependency on ancestor properties being present on every entity** is an assumption that has to be maintained by the data source — if a regso row doesn't carry `komun` and `region` columns, the whole thing breaks silently

**What's missing vs. a fully general solution:**
A tree-path filter — `{ path: ["01", "0162"] }` meaning "show the subtree rooted at 0162 within region 01" — would be more explicit. But it requires the reader to understand tree semantics, which is a much bigger protocol change.

---


## Test cases for manual testing

Here's a structured manual test plan, ordered from simple to tricky:

---

### Basic explode/fold
1. **Komun → regso**: right-click any komun → explode to regso → verify that komun disappears, its regsos appear, all other kommuns untouched
2. **Fold back**: fold that regso back to komun → verify full round-trip, URL identical to start
3. **Two kommuns exploded**: explode komun A then komun B to regso → both their regso sets visible, siblings hidden. Fold A back → B still exploded, A komun reappears

### Cross-level (region folder)
4. **Region → regso**: right-click a region folder → only "explode to regso" shows (no "explode to komun"). Explode → all region's kommuns disappear, all region's regsos appear
5. **Fold one regso back after region explode**: right-click a regso in that exploded region → fold to komun → only that komun reappears, all its sibling kommuns still hidden, its own regsos gone ← *this is the main scenario we fixed*
6. **Fold a second regso back**: fold another regso in the same region → that komun reappears too. Eventually fold all regsos back one by one → region's kommuns all visible again

### Stacking
7. **Region exploded + then explode one of its kommuns deeper**: region→regso active, then right-click one of those regsos and fold to komun, then right-click that komun and explode to regso again → should be a no-op round-trip
8. **Two regions exploded**: explode region 01, then region 03 → fold one back while 03 stays exploded. Verify $nor still has region 03 gating

### Markercontrols — find/add/remove
9. **Remove a single komun** via the find section checkboxes → it disappears from chart, URL gets a specific marker exclusion or dimension filter entry. Explode it to regso → does it reappear as regsos? (likely yes since the filter operates differently)
10. **Add a komun** that was removed → it reappears
11. **Remove a region group** (folder checkbox) → all kommuns in that region hidden. Then explode a neighboring region → verify they don't interfere
12. **Switch from komun to regso level** via the shortcut switch in markercontrols → all markers switch to regso. Then right-click a regso → fold button should appear pointing to komun; region folder should show explode to regso only

### Edge/destructive cases
13. **Explode, then switch level via shortcut** → does the explode filter get cleaned up or is there stale state?
14. **Explode a komun, then remove it via find section** → regsos stay? Or does the filter conflict?
15. **Start from regso base** (switch level first), then explode a komun → since base is now `is--regso`, explode from komun should produce `is--regso gated by komun` — already the base, so it may be a no-op or show no change

---

Cases **5, 6, 8** are the ones most likely to expose remaining edge cases in `_fixAncestorNorOnFold`. Cases **13–15** probe the interaction between the switch mechanism and the explode/fold state.