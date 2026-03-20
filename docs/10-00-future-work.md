# Architecture review: pros and cons

## What works well for the purpose

**Declarative config as single source of truth.** For a system where users share visualizations via URL-encoded state, having one serializable config object that fully describes the visualization is exactly right. The config → model → output pipeline makes reproducing a chart trivial.

**Autoconfig is the killer feature.** The configSolver that resolves missing concepts and spaces from availability is genuinely novel. Most charting libraries require you to specify everything upfront. Here you can swap a dataset and get a reasonable default visualization. For Gapminder's "explore any indicator" use case, this is essential and well-designed — the space-sorting heuristic (prefer 2D, then try 1D) and the `selectUnusedConcept` strategy are simple and effective.

**Reactive is the correct paradigm.** Interactive visualization where the user drags time sliders, clicks entities, zooms axes, and switches indicators — MobX computed properties handle this naturally. Manual event wiring at this complexity would be unmaintainable.

**Boxed computed pipeline is elegant.** Each transformation step only observes its predecessor. Change the filter? Only post-filter steps recompute. Scrub the time slider? Only `currentFrame` recomputes (interpolateBetween between two cached frames). This granularity is critical for smooth 60fps animation.

**DataFrame with key awareness.** O(1) lookup by composite key is essential for frame animation — `interpolateBetween` needs to match rows in frame N to rows in frame N+1. The Map-based structure with `¬`-separated key strings is simple, fast, and sufficient for the typical dataset sizes (thousands to low millions of rows).

**The full-join + amend classification** (defining / ammendGet / ammendWrite / no-op) is a smart optimization. Lazy getters for category lookups avoid materializing columns that might never be read during a frame render.

## What I'd push back on

**Config is both input AND mutable state.** The configSolver loopback — `reaction(() => solution, ({space, concept}) => { this.config.space = space })` — means the config you pass in is *not* the config you get back. Auto-resolved values are written into it. This conflates user intent with derived state. It makes questions like "did the user choose this concept, or was it auto-selected?" unanswerable from the config alone. A cleaner separation (immutable user config + derived resolved config) would make the system easier to reason about.

**Deep parent traversals create tight coupling.** `this.parent.marker.data.source`, `this.parent.marker.transformedDataMaps.get(source).get()`, `this.parent.parent` (palette → color scale → encoding). These reach through 2-3 layers of hierarchy, which means:
- Models can't be tested in isolation without mocking the entire tree
- Refactoring any model's position in the hierarchy breaks its children
- The actual dependency graph is hidden in getter implementations rather than explicit in construction

**MobX 5 is end-of-life tech debt.** MobX 5's proxy-based observables work fine, but the project is unmigrateable to MobX 6 without touching every model (different decorator semantics, `makeObservable` requirement). The longer this sits, the worse it gets.

**No TypeScript in a system with this many implicit contracts.** The codebase relies on: `"is--"` naming convention, `Symbol.for('key')` on row objects, `modelType` strings for store dispatch, config shapes validated only at runtime, parent hierarchy structured "just so." TypeScript would catch an enormous class of bugs that currently only surface as deep-stack runtime errors inside MobX reactions (which swallow stack traces).

**The limited-structure filter is over-engineered.** The `$or`/`$nor` with isness markers, cartesian permutations, `appendToFilterSpec`/`substractFromFilterSpec` with blueprint matching — this is a mini query engine embedded inside the filter model, all to handle one specific use case (DDF entity hierarchies with set membership). The complexity cost is high relative to how often this path is exercised. A simpler "include list + exclude list per dimension" would cover 90% of cases.

**`sleep()` for query batching is timing-dependent.** Relying on microtask ordering to combine queries is fragile — different JS environments, busy event loops, or async reader implementations could break the batching assumption. An explicit `flush()` signal or a debounce with configurable window would be more robust.

**Monolithic model files.** `marker.js` is the transformation pipeline, the encoding classifier, the state manager, and the data cache all in one object. `dataConfig.js` is the query builder, the domain calculator, the availability checker, and the concept resolver. Decomposing these into focused concerns would improve readability and testability.

## The fundamental tension

This is a **framework** that encodes a specific worldview: data is multidimensional, organized in DDF-style entity domains/sets with isness hierarchies, queried via DDFQL, and animated through time. If your data fits that model — as Gapminder's data perfectly does — the autoconfig, drillup/drilldown, and transformation pipeline are genuinely powerful. If your data *doesn't* fit (say, a simple CSV with no entity concept types), you're carrying a lot of machinery that doesn't help you.

For Gapminder's purpose specifically, the architecture is **well-suited but showing its age**. The reactive model, declarative config, and autoconfig are the right ideas. The execution suffers from tight coupling, missing type safety, and complexity in the filter/entity-membership areas that could be simplified. The boxed-computed pipeline and DataFrame design are the strongest parts — they solve real performance problems elegantly.
