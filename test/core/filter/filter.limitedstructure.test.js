/**
 * Unit tests for filter.js LIMITED STRUCTURE API
 *
 * Tests are fully self-contained — no fixture datasets or data sources needed.
 * All scenarios use a synthetic geo hierarchy: Sverige → region → komun → regso
 *
 * See docs/09-03-filter-limited-structure.md for the design rationale.
 */

import { toJS } from 'mobx';
import { filter } from '../../../src/core/filter/filter';

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Create a fresh observable filter with given dimensions config (deep-cloned so tests don't share state) */
function mkFilter(dimensions = {}) {
    return filter({ dimensions: JSON.parse(JSON.stringify(dimensions)) }, null, 'test');
}

/** Return plain-object snapshot of the geo dimension for assertions */
function geo(f) {
    return toJS(f.config.dimensions.geo) ?? {};
}

// ─── addUsingLimitedStructure ─────────────────────────────────────────────────

describe('addUsingLimitedStructure', () => {

    it('adds a new $or clause with isness + prop gate', () => {
        const f = mkFilter({ geo: { $or: [{ 'is--region': true }] } });
        f.addUsingLimitedStructure({ dim: 'geo', isness: 'is--komun', prop: 'region', key: 'vastsverige' });
        expect(geo(f).$or).toEqual([
            { 'is--region': true },
            { 'is--komun': true, 'region': { $in: ['vastsverige'] } }
        ]);
    });

    it('reader limitation: when prop matches isness, prop is replaced with dim', () => {
        // "is--" + "region" === "is--region" → prop "region" must become "geo"
        const f = mkFilter({});
        f.addUsingLimitedStructure({ dim: 'geo', isness: 'is--region', prop: 'region', key: 'vastsverige' });
        expect(geo(f).$or).toEqual([
            { 'is--region': true, 'geo': { $in: ['vastsverige'] } }
        ]);
    });

    it('merges multiple keys into the same $in when blueprint matches', () => {
        const f = mkFilter({});
        f.addUsingLimitedStructure({ dim: 'geo', isness: 'is--komun', prop: 'region', key: 'vastsverige' });
        f.addUsingLimitedStructure({ dim: 'geo', isness: 'is--komun', prop: 'region', key: 'stockholm' });
        expect(geo(f).$or).toEqual([
            { 'is--komun': true, 'region': { $in: ['vastsverige', 'stockholm'] } }
        ]);
    });

    it('accepts a vectorised (array) key and merges all values into one $in', () => {
        const f = mkFilter({});
        f.addUsingLimitedStructure({ dim: 'geo', isness: 'is--komun', prop: 'region', key: ['vastsverige', 'stockholm'] });
        expect(geo(f).$or).toEqual([
            { 'is--komun': true, 'region': { $in: ['vastsverige', 'stockholm'] } }
        ]);
    });

    it('if key is already in $nor, removes it from $nor instead of adding to $or', () => {
        const f = mkFilter({ geo: { $nor: [{ 'is--komun': true, 'region': { $in: ['vastsverige'] } }] } });
        f.addUsingLimitedStructure({ dim: 'geo', isness: 'is--komun', prop: 'region', key: 'vastsverige' });
        // $nor clause pruned; no $or created
        expect(geo(f).$nor).toBeUndefined();
        expect(geo(f).$or).toBeUndefined();
    });

    it('if one of vectorised keys is in $nor, only that key is removed from $nor', () => {
        const f = mkFilter({ geo: { $nor: [{ 'is--komun': true, 'region': { $in: ['vastsverige'] } }] } });
        f.addUsingLimitedStructure({ dim: 'geo', isness: 'is--komun', prop: 'region', key: ['vastsverige', 'stockholm'] });
        // vastsverige removed from $nor; stockholm added to $or
        expect(geo(f).$nor).toBeUndefined();
        expect(geo(f).$or).toEqual([
            { 'is--komun': true, 'region': { $in: ['stockholm'] } }
        ]);
    });

});

// ─── deleteUsingLimitedStructure ─────────────────────────────────────────────

describe('deleteUsingLimitedStructure', () => {

    it('creates a $nor clause with isness + prop gate', () => {
        const f = mkFilter({ geo: { $or: [{ 'is--region': true }] } });
        f.deleteUsingLimitedStructure({ dim: 'geo', isness: 'is--region', prop: 'world_4region', key: 'asia' });
        expect(geo(f).$nor).toEqual([
            { 'is--region': true, 'world_4region': { $in: ['asia'] } }
        ]);
    });

    it('reader limitation: prop matching isness is replaced with dim', () => {
        const f = mkFilter({});
        f.deleteUsingLimitedStructure({ dim: 'geo', isness: 'is--region', prop: 'region', key: 'vastsverige' });
        expect(geo(f).$nor).toEqual([
            { 'is--region': true, 'geo': { $in: ['vastsverige'] } }
        ]);
    });

    it('if key is already in $or, removes it from $or instead of adding to $nor', () => {
        const f = mkFilter({ geo: { $or: [{ 'is--komun': true, 'region': { $in: ['vastsverige'] } }] } });
        f.deleteUsingLimitedStructure({ dim: 'geo', isness: 'is--komun', prop: 'region', key: 'vastsverige' });
        // $or clause pruned; no $nor created
        expect(geo(f).$or).toBeUndefined();
        expect(geo(f).$nor).toBeUndefined();
    });

    it('reader-limited delete removes a reader-limited $or clause', () => {
        const f = mkFilter({ geo: { $or: [{ 'is--region': true, 'geo': { $in: ['vastsverige'] } }] } });
        // prop "region" is reader-limited to "geo" since isness = "is--region"
        f.deleteUsingLimitedStructure({ dim: 'geo', isness: 'is--region', prop: 'region', key: 'vastsverige' });
        expect(geo(f).$or).toBeUndefined();
        expect(geo(f).$nor).toBeUndefined();
    });

    it('accepts vectorised key', () => {
        const f = mkFilter({});
        f.deleteUsingLimitedStructure({ dim: 'geo', isness: 'is--komun', prop: 'region', key: ['vastsverige', 'stockholm'] });
        expect(geo(f).$nor).toEqual([
            { 'is--komun': true, 'region': { $in: ['vastsverige', 'stockholm'] } }
        ]);
    });

});

// ─── findOutIsnessUsingLimitedStructure ───────────────────────────────────────

describe('findOutIsnessUsingLimitedStructure', () => {

    it('returns null when no $or exists', () => {
        const f = mkFilter({});
        expect(f.findOutIsnessUsingLimitedStructure({ dim: 'geo' })).toBeNull();
    });

    it('returns the single isness string when all clauses share one', () => {
        const f = mkFilter({ geo: { $or: [{ 'is--region': true }, { 'is--region': true, 'geo': { $in: ['vastsverige'] } }] } });
        expect(f.findOutIsnessUsingLimitedStructure({ dim: 'geo' })).toBe('is--region');
    });

    it('returns an array when multiple isnesses appear in $or', () => {
        const f = mkFilter({ geo: { $or: [{ 'is--region': true }, { 'is--komun': true }] } });
        expect(f.findOutIsnessUsingLimitedStructure({ dim: 'geo' })).toEqual(['is--region', 'is--komun']);
    });

});

// ─── switchIsenssUsingLimitedStructure ────────────────────────────────────────

describe('switchIsenssUsingLimitedStructure', () => {

    it('hard switch: resets to new isness when no prior isness exists', () => {
        const f = mkFilter({});
        f.switchIsenssUsingLimitedStructure({ dim: 'geo', isness: 'is--country' });
        expect(geo(f)).toEqual({ $or: [{ 'is--country': true }] });
    });

    it('hard switch: resets to new isness when multiple isnesses exist', () => {
        const f = mkFilter({ geo: { $or: [{ 'is--region': true }, { 'is--komun': true }] } });
        f.switchIsenssUsingLimitedStructure({ dim: 'geo', isness: 'is--country' });
        expect(geo(f)).toEqual({ $or: [{ 'is--country': true }] });
    });

    it('soft switch: renames isness in all $or and $nor clauses', () => {
        const f = mkFilter({
            geo: {
                $or:  [{ 'is--region': true, 'geo': { $in: ['vastsverige'] } }],
                $nor: [{ 'is--region': true, 'geo': { $in: ['orebro'] } }]
            }
        });
        f.switchIsenssUsingLimitedStructure({ dim: 'geo', isness: 'is--komun' });
        expect(geo(f).$or[0]['is--komun']).toBe(true);
        expect(geo(f).$or[0]['is--region']).toBeUndefined();
        expect(geo(f).$nor[0]['is--komun']).toBe(true);
        expect(geo(f).$nor[0]['is--region']).toBeUndefined();
    });

    it('soft switch: applies reader-limitation rename when new isness matches existing prop', () => {
        // item has prop "komun" stored; switching to "is--komun" → prop "komun" must become "geo"
        const f = mkFilter({ geo: { $or: [{ 'is--region': true, 'komun': { $in: ['malmo'] } }] } });
        f.switchIsenssUsingLimitedStructure({ dim: 'geo', isness: 'is--komun' });
        expect(geo(f).$or[0]).toEqual({ 'is--komun': true, 'geo': { $in: ['malmo'] } });
    });

});

// ─── explode workflow (simulating clickToExplode) ─────────────────────────────

describe('explode workflow — compact form', () => {

    it('single-step explode from root: komun → regso produces compact filter (regression for !prevProp bug)', () => {
        // drilldown="komun.regso", start showing all kommuns
        const f = mkFilter({ geo: { $or: [{ 'is--komun': true }] } });

        // clickToExplode: prop="komun", explodeProp="regso"
        f.addUsingLimitedStructure({ dim: 'geo', isness: 'is--regso', prop: 'komun', key: '1384' });
        f.deleteUsingLimitedStructure({ dim: 'geo', isness: 'is--komun', prop: 'komun', key: '1384' });

        expect(geo(f)).toEqual({
            $or:  [{ 'is--komun': true }, { 'is--regso': true, 'komun': { $in: ['1384'] } }],
            $nor: [{ 'is--komun': true, 'geo': { $in: ['1384'] } }]
        });
        // Critically: no enumeration of individual regso IDs — just the one parent key "1384"
    });

    it('cross-level skip explode: region → regso (bypassing komun) is equally compact', () => {
        // drilldown="region.komun.regso", start showing all regions
        const f = mkFilter({ geo: { $or: [{ 'is--region': true }] } });

        // clickToExplode: prop="region", explodeProp="regso"
        f.addUsingLimitedStructure({ dim: 'geo', isness: 'is--regso', prop: 'region', key: 'vastsverige' });
        f.deleteUsingLimitedStructure({ dim: 'geo', isness: 'is--region', prop: 'region', key: 'vastsverige' });

        expect(geo(f)).toEqual({
            $or:  [{ 'is--region': true }, { 'is--regso': true, 'region': { $in: ['vastsverige'] } }],
            $nor: [{ 'is--region': true, 'geo': { $in: ['vastsverige'] } }]
        });
        // No enumeration of all kommuns or all regsos: just one compact gate on region key
    });

    it('single-step explode: region → komun', () => {
        const f = mkFilter({ geo: { $or: [{ 'is--region': true }] } });

        f.addUsingLimitedStructure({ dim: 'geo', isness: 'is--komun', prop: 'region', key: 'vastsverige' });
        f.deleteUsingLimitedStructure({ dim: 'geo', isness: 'is--region', prop: 'region', key: 'vastsverige' });

        expect(geo(f)).toEqual({
            $or:  [{ 'is--region': true }, { 'is--komun': true, 'region': { $in: ['vastsverige'] } }],
            $nor: [{ 'is--region': true, 'geo': { $in: ['vastsverige'] } }]
        });
    });

    it('cross-level skip from komun base: region → regso removes region kommuns (regression)', () => {
        // Real-world case: filter starts as {is--komun:true} (all kommuns shown).
        // User right-clicks a region folder and explodes it to regso.
        // prop="region", explodeProp="regso", currentIsnesses=["is--komun"].
        // Only the is--komun delete should fire (is--region is not active → no stale $nor).
        const f = mkFilter({ geo: { $or: [{ 'is--komun': true }] } });

        // Simulates the loop in clickToExplode:
        //   i=0 "is--region" not in ["is--komun"] → skipped
        //   i=1 "is--komun" in ["is--komun"] → fires
        f.addUsingLimitedStructure({ dim: 'geo', isness: 'is--regso', prop: 'region', key: '01' });
        f.deleteUsingLimitedStructure({ dim: 'geo', isness: 'is--komun', prop: 'region', key: '01' });

        expect(geo(f)).toEqual({
            $or:  [{ 'is--komun': true }, { 'is--regso': true, 'region': { $in: ['01'] } }],
            $nor: [{ 'is--komun': true, 'region': { $in: ['01'] } }]
        });
        // Net: all kommuns except those in region 01, plus all regsos of region 01.
        // No individual komun IDs enumerated, no stale is--region $nor.
    });

    it('exploding two regions merges their keys into one $in clause', () => {
        const f = mkFilter({ geo: { $or: [{ 'is--region': true }] } });

        f.addUsingLimitedStructure({ dim: 'geo', isness: 'is--komun', prop: 'region', key: 'vastsverige' });
        f.deleteUsingLimitedStructure({ dim: 'geo', isness: 'is--region', prop: 'region', key: 'vastsverige' });
        f.addUsingLimitedStructure({ dim: 'geo', isness: 'is--komun', prop: 'region', key: 'stockholm' });
        f.deleteUsingLimitedStructure({ dim: 'geo', isness: 'is--region', prop: 'region', key: 'stockholm' });

        expect(geo(f)).toEqual({
            $or:  [{ 'is--region': true }, { 'is--komun': true, 'region': { $in: ['vastsverige', 'stockholm'] } }],
            $nor: [{ 'is--region': true, 'geo': { $in: ['vastsverige', 'stockholm'] } }]
        });
    });

});

// ─── fold workflow (simulating clickToFold) ───────────────────────────────────

describe('fold workflow — primary compact fold', () => {

    it('fold komun back to region: restores exact original state (round-trip)', () => {
        // drilldown="region.komun.regso"
        const initial = { geo: { $or: [{ 'is--region': true }] } };
        const f = mkFilter(initial);

        // Explode vastsverige → komun
        f.addUsingLimitedStructure({ dim: 'geo', isness: 'is--komun', prop: 'region', key: 'vastsverige' });
        f.deleteUsingLimitedStructure({ dim: 'geo', isness: 'is--region', prop: 'region', key: 'vastsverige' });

        // Fold back: d.prop="komun", foldProp="region", foldValue="vastsverige"
        f.deleteUsingLimitedStructure({ dim: 'geo', isness: 'is--komun', prop: 'region', key: 'vastsverige' });
        f.addUsingLimitedStructure({ dim: 'geo', isness: 'is--region', prop: 'region', key: 'vastsverige' });

        expect(geo(f)).toEqual(initial.geo);
    });

    it('fold one of two exploded regions: leaves the other intact', () => {
        const f = mkFilter({ geo: { $or: [{ 'is--region': true }] } });

        // Explode two regions
        f.addUsingLimitedStructure({ dim: 'geo', isness: 'is--komun', prop: 'region', key: 'vastsverige' });
        f.deleteUsingLimitedStructure({ dim: 'geo', isness: 'is--region', prop: 'region', key: 'vastsverige' });
        f.addUsingLimitedStructure({ dim: 'geo', isness: 'is--komun', prop: 'region', key: 'stockholm' });
        f.deleteUsingLimitedStructure({ dim: 'geo', isness: 'is--region', prop: 'region', key: 'stockholm' });

        // Fold only vastsverige back
        f.deleteUsingLimitedStructure({ dim: 'geo', isness: 'is--komun', prop: 'region', key: 'vastsverige' });
        f.addUsingLimitedStructure({ dim: 'geo', isness: 'is--region', prop: 'region', key: 'vastsverige' });

        // stockholm still exploded; vastsverige restored (folded back into the catch-all $or region clause)
        expect(geo(f)).toEqual({
            $or:  [{ 'is--region': true }, { 'is--komun': true, 'region': { $in: ['stockholm'] } }],
            $nor: [{ 'is--region': true, 'geo': { $in: ['stockholm'] } }]
        });
    });

    it('fold restores state after cross-level skip explode (region → regso)', () => {
        const initial = { geo: { $or: [{ 'is--region': true }] } };
        const f = mkFilter(initial);

        // Cross-level explode
        f.addUsingLimitedStructure({ dim: 'geo', isness: 'is--regso', prop: 'region', key: 'vastsverige' });
        f.deleteUsingLimitedStructure({ dim: 'geo', isness: 'is--region', prop: 'region', key: 'vastsverige' });

        // Fold back using the "fold to region" action
        // (foldProp of regso in drilldown "region.komun.regso" would be "komun",
        //  but with a cross-level skip we fold using the stored gate prop = "region")
        f.deleteUsingLimitedStructure({ dim: 'geo', isness: 'is--regso', prop: 'region', key: 'vastsverige' });
        f.addUsingLimitedStructure({ dim: 'geo', isness: 'is--region', prop: 'region', key: 'vastsverige' });

        expect(geo(f)).toEqual(initial.geo);
    });

});

// ─── complex mixed scenario ───────────────────────────────────────────────────

describe('complex mixed operations', () => {

    it('explode region→komun, then explode one komun→regso, filter is correct', () => {
        // Start: all regions
        const f = mkFilter({ geo: { $or: [{ 'is--region': true }] } });

        // Explode vastsverige → kommuns
        f.addUsingLimitedStructure({ dim: 'geo', isness: 'is--komun', prop: 'region', key: 'vastsverige' });
        f.deleteUsingLimitedStructure({ dim: 'geo', isness: 'is--region', prop: 'region', key: 'vastsverige' });

        // Explode komun 1384 (Gothenburg) → regso
        f.addUsingLimitedStructure({ dim: 'geo', isness: 'is--regso', prop: 'komun', key: '1384' });
        f.deleteUsingLimitedStructure({ dim: 'geo', isness: 'is--komun', prop: 'komun', key: '1384' });

        // Result: all regions except vastsverige
        //         all kommuns of vastsverige except 1384
        //         all regsos of komun 1384
        expect(geo(f)).toEqual({
            $or: [
                { 'is--region': true },
                { 'is--komun': true, 'region': { $in: ['vastsverige'] } },
                { 'is--regso': true, 'komun': { $in: ['1384'] } }
            ],
            $nor: [
                { 'is--region': true, 'geo': { $in: ['vastsverige'] } },
                { 'is--komun': true, 'geo': { $in: ['1384'] } }
            ]
        });
    });

    it('fold-back cleanup of deeper-level $or: remove regso entries when folding region', () => {
        // After the complex state above, fold komun 1384 back (using the deeper cleanup path)
        // This simulates the async cleanup part of clickToFold when nextProp exists.
        // Starting from the complex state:
        const f = mkFilter({ geo: {
            $or: [
                { 'is--region': true },
                { 'is--komun': true, 'region': { $in: ['vastsverige'] } },
                { 'is--regso': true, 'komun': { $in: ['1384'] } }
            ],
            $nor: [
                { 'is--region': true, 'geo': { $in: ['vastsverige'] } },
                { 'is--komun': true, 'geo': { $in: ['1384'] } }
            ]
        }});

        // Primary fold of komun 1384 back into its region (vastsverige):
        // foldProp="region", foldValue="vastsverige"
        f.deleteUsingLimitedStructure({ dim: 'geo', isness: 'is--komun', prop: 'region', key: 'vastsverige' });
        f.addUsingLimitedStructure({ dim: 'geo', isness: 'is--region', prop: 'region', key: 'vastsverige' });

        // Deeper cleanup: remove is--regso $or entry gated by komun 1384
        // and undo the is--komun $nor entry (created when 1384 was exploded)
        // This simulates the drilldown async callback in clickToFold
        f.deleteUsingLimitedStructure({ dim: 'geo', isness: 'is--regso', prop: 'komun', key: ['1384'] });
        f.addUsingLimitedStructure({ dim: 'geo', isness: 'is--komun', prop: 'komun', key: ['1384'] });

        // Back to all-regions with vastsverige unexploded
        expect(geo(f)).toEqual({ $or: [{ 'is--region': true }] });
    });

    it('the all-regions start filter survives an identity explode+fold cycle without corruption', () => {
        const initial = { geo: { $or: [{ 'is--region': true }] } };
        const f = mkFilter(initial);

        // Three independent explode+fold cycles on different regions
        for (const region of ['vastsverige', 'stockholm', 'orebro']) {
            f.addUsingLimitedStructure({ dim: 'geo', isness: 'is--komun', prop: 'region', key: region });
            f.deleteUsingLimitedStructure({ dim: 'geo', isness: 'is--region', prop: 'region', key: region });
            f.deleteUsingLimitedStructure({ dim: 'geo', isness: 'is--komun', prop: 'region', key: region });
            f.addUsingLimitedStructure({ dim: 'geo', isness: 'is--region', prop: 'region', key: region });
        }

        expect(geo(f)).toEqual(initial.geo);
    });

});

// ─── fold-in-exploded-context: sibling enumeration ───────────────────────────

describe('fold within ancestor-level explode — sibling enumeration', () => {

    // Simulates _fixAncestorNorOnFold after the primary fold steps.
    // Starting state: region 01 was exploded to regso from a komun base.
    //   $or: { is--komun: true }, { is--regso, region: [01] }
    //   $nor: { is--komun, region: [01] }
    //
    // User folds Danderyd (komun 0162) regsos back to komun.
    // Primary fold creates:
    //   $or adds { is--komun, geo: [0162] }  (redundant but harmless)
    //   $nor adds { is--regso, komun: [0162] }
    // Then _fixAncestorNorOnFold fires:
    //   1. removes "01" from ancestor $nor (is--komun, region: [01])
    //   2. adds siblings (all region 01 kommuns except 0162) to $nor
    //   3. removes the redundant $or entry for 0162

    const SIBLINGS = ['0114', '0115', '0117', '0120', '0123', '0180']; // simplified region 01

    function buildExplodedState() {
        return mkFilter({ geo: {
            $or: [
                { 'is--komun': true },
                { 'is--regso': true, 'region': { $in: ['01'] } }
            ],
            $nor: [
                { 'is--komun': true, 'region': { $in: ['01'] } }
            ]
        }});
    }

    it('primary fold: removes regsos of 0162, tries to add 0162 (initially blocked)', () => {
        const f = buildExplodedState();

        // Primary fold in clickToFold:
        f.deleteUsingLimitedStructure({ dim: 'geo', isness: 'is--regso', prop: 'komun', key: '0162' });
        f.addUsingLimitedStructure({ dim: 'geo', isness: 'is--komun', prop: 'komun', key: '0162' });

        // $or gains a redundant entry for 0162 (komun→geo reader-limited)
        // $nor gains the regso blocker for 0162
        // BUT komun 0162 is still blocked by $nor { is--komun, region: [01] }
        const g = geo(f);
        expect(g.$or.some(c => c['is--komun'] && c.geo?.$in?.includes('0162'))).toBe(true);
        expect(g.$nor.some(c => c['is--komun'] && c.region?.$in?.includes('01'))).toBe(true); // still there!
    });

    it('_fixAncestorNorOnFold: replaces ancestor $nor with sibling enumeration', () => {
        const f = buildExplodedState();

        // Primary fold
        f.deleteUsingLimitedStructure({ dim: 'geo', isness: 'is--regso', prop: 'komun', key: '0162' });
        f.addUsingLimitedStructure({ dim: 'geo', isness: 'is--komun', prop: 'komun', key: '0162' });

        // _fixAncestorNorOnFold simulation (ancestorProp="region", ancestorKey="01"):
        // 1. Remove ancestor $nor entry for region 01
        f.addUsingLimitedStructure({ dim: 'geo', isness: 'is--komun', prop: 'region', key: '01' });
        // 2. Add sibling-level $nor for remaining kommuns
        f.deleteUsingLimitedStructure({ dim: 'geo', isness: 'is--komun', prop: 'komun', key: SIBLINGS });
        // 3. Remove redundant $or entry for 0162
        f.deleteUsingLimitedStructure({ dim: 'geo', isness: 'is--komun', prop: 'komun', key: '0162' });

        const g = geo(f);

        // Ancestor-level $nor is gone
        expect(g.$nor.some(c => c['is--komun'] && c.region)).toBe(false);

        // Sibling-level $nor is present (stops siblings from re-appearing)
        expect(g.$nor.some(c => c['is--komun'] && c.geo?.$in?.length === SIBLINGS.length)).toBe(true);

        // 0162 is NOT in the $nor sibling list → it will be shown via catchall is--komun
        const siblingsInNor = g.$nor.find(c => c['is--komun'] && c.geo?.$in)?.geo?.$in || [];
        expect(siblingsInNor).not.toContain('0162');
        expect(siblingsInNor).toEqual(expect.arrayContaining(SIBLINGS));

        // Regso blocker for 0162 is present
        expect(g.$nor.some(c => c['is--regso'] && c.komun?.$in?.includes('0162'))).toBe(true);

        // No redundant $or entry for 0162 (cleaned up)
        expect(g.$or.some(c => c['is--komun'] && c.geo?.$in?.includes('0162'))).toBe(false);

        // The regso group for region 01 is still in $or (other kommuns' regsos stay visible)
        expect(g.$or.some(c => c['is--regso'] && c.region?.$in?.includes('01'))).toBe(true);
    });

    it('ancestor $nor with multiple regions: only the matching region key is restructured', () => {
        // Both region 01 and region 03 were exploded; $nor covers both
        const f = mkFilter({ geo: {
            $or: [
                { 'is--komun': true },
                { 'is--regso': true, 'region': { $in: ['01', '03'] } }
            ],
            $nor: [
                { 'is--komun': true, 'region': { $in: ['01', '03'] } }
            ]
        }});

        // _fixAncestorNorOnFold for komun 0162 in region 01 only
        f.addUsingLimitedStructure({ dim: 'geo', isness: 'is--komun', prop: 'region', key: '01' });
        f.deleteUsingLimitedStructure({ dim: 'geo', isness: 'is--komun', prop: 'komun', key: SIBLINGS });

        const g = geo(f);

        // Region 03 still excluded via ancestor $nor
        expect(g.$nor.some(c => c['is--komun'] && c.region?.$in?.includes('03'))).toBe(true);
        // Region 01 no longer in ancestor $nor
        expect(g.$nor.some(c => c['is--komun'] && c.region?.$in?.includes('01'))).toBe(false);
        // Siblings of region 01 now enumerated in $nor
        expect(g.$nor.some(c => c['is--komun'] && c.geo?.$in?.length === SIBLINGS.length)).toBe(true);
    });

});

// ─── multiple ancestor keys in one $nor clause ───────────────────────────────

describe('multiple ancestor keys in one $nor clause', () => {

    it('removing one ancestor key from a $nor clause leaves others intact', () => {
        // $nor has region: { $in: ['01', '03'] }; remove only '01'
        const f = mkFilter({ geo: {
            $or: [{ 'is--komun': true }],
            $nor: [{ 'is--komun': true, 'region': { $in: ['01', '03'] } }]
        }});

        f.addUsingLimitedStructure({ dim: 'geo', isness: 'is--komun', prop: 'region', key: '01' });

        const g = geo(f);
        // '03' still in $nor
        expect(g.$nor).toEqual([{ 'is--komun': true, 'region': { $in: ['03'] } }]);
        // no new $or clause created (01 was already excluded, now un-excluded)
        expect(g.$or).toEqual([{ 'is--komun': true }]);
    });

    it('removing the last key from a $nor clause prunes the whole clause', () => {
        const f = mkFilter({ geo: {
            $or: [{ 'is--komun': true }],
            $nor: [{ 'is--komun': true, 'region': { $in: ['01'] } }]
        }});

        f.addUsingLimitedStructure({ dim: 'geo', isness: 'is--komun', prop: 'region', key: '01' });

        const g = geo(f);
        expect(g.$nor).toBeUndefined();
        expect(g.$or).toEqual([{ 'is--komun': true }]);
    });

    it('removing the last key from a $or clause prunes the whole clause', () => {
        const f = mkFilter({ geo: {
            $or: [
                { 'is--region': true },
                { 'is--komun': true, 'region': { $in: ['01'] } }
            ]
        }});

        f.deleteUsingLimitedStructure({ dim: 'geo', isness: 'is--komun', prop: 'region', key: '01' });

        const g = geo(f);
        // The komun $or clause is pruned; region catch-all survives
        expect(g.$or).toEqual([{ 'is--region': true }]);
    });

});

// ─── reader limitation in isAlreadyRemovedUsingLimitedStructure ──────────────

describe('reader limitation: isAlreadyRemoved / isAlreadyAdded with matching prop', () => {

    it('isAlreadyRemovedUsingLimitedStructure remaps prop to dim when prop matches isness', () => {
        // Stored as { 'is--region': true, 'geo': { $in: ['vastsverige'] } }
        // Query uses prop='region', isness='is--region' → prop remapped to 'geo'
        const f = mkFilter({ geo: {
            $nor: [{ 'is--region': true, 'geo': { $in: ['vastsverige'] } }]
        }});

        // addUsingLimitedStructure detects it's in $nor and removes it instead of adding to $or
        f.addUsingLimitedStructure({ dim: 'geo', isness: 'is--region', prop: 'region', key: 'vastsverige' });

        const g = geo(f);
        expect(g.$nor).toBeUndefined();
        expect(g.$or).toBeUndefined();
    });

    it('isAlreadyAddedUsingLimitedStructure remaps prop to dim when prop matches isness', () => {
        // Stored as { 'is--region': true, 'geo': { $in: ['vastsverige'] } }
        // deleteUsingLimitedStructure detects it's in $or and removes it
        const f = mkFilter({ geo: {
            $or: [{ 'is--region': true, 'geo': { $in: ['vastsverige'] } }]
        }});

        f.deleteUsingLimitedStructure({ dim: 'geo', isness: 'is--region', prop: 'region', key: 'vastsverige' });

        const g = geo(f);
        expect(g.$or).toBeUndefined();
        expect(g.$nor).toBeUndefined();
    });

});

// ─── findOutIsnessUsingLimitedStructure: multi-isness during cross-level explode

describe('findOutIsness during cross-level explode produces array', () => {

    it('returns array when both is--komun and is--regso appear in $or simultaneously', () => {
        // Mid-state: komun catchall + regso entry for one region
        const f = mkFilter({ geo: {
            $or: [
                { 'is--komun': true },
                { 'is--regso': true, 'region': { $in: ['01'] } }
            ]
        }});

        const result = f.findOutIsnessUsingLimitedStructure({ dim: 'geo' });
        expect(Array.isArray(result)).toBe(true);
        expect(result).toEqual(expect.arrayContaining(['is--komun', 'is--regso']));
    });

    it('returns single string after fold restores one isness', () => {
        const f = mkFilter({ geo: {
            $or: [{ 'is--komun': true }]
        }});

        expect(f.findOutIsnessUsingLimitedStructure({ dim: 'geo' })).toBe('is--komun');
    });

});

// ─── switchIsenssUsingLimitedStructure: soft-switch preserves gates ───────────

describe('switchIsenssUsingLimitedStructure: soft-switch detail', () => {

    it('soft switch: gates ($in values) are preserved unchanged', () => {
        const f = mkFilter({ geo: {
            $or:  [{ 'is--region': true, 'geo': { $in: ['vastsverige', 'stockholm'] } }],
            $nor: [{ 'is--region': true, 'geo': { $in: ['orebro'] } }]
        }});

        f.switchIsenssUsingLimitedStructure({ dim: 'geo', isness: 'is--komun' });

        const g = geo(f);
        expect(g.$or[0]).toEqual({ 'is--komun': true, 'geo': { $in: ['vastsverige', 'stockholm'] } });
        expect(g.$nor[0]).toEqual({ 'is--komun': true, 'geo': { $in: ['orebro'] } });
    });

    it('soft switch: applies reader-limitation rename when new isness matches existing prop', () => {
        // prop "region" stored; switching to "is--region" renames "region" → "geo"
        const f = mkFilter({ geo: { $or: [{ 'is--komun': true, 'region': { $in: ['stockholm'] } }] } });
        f.switchIsenssUsingLimitedStructure({ dim: 'geo', isness: 'is--region' });

        const g = geo(f);
        expect(g.$or[0]).toEqual({ 'is--region': true, 'geo': { $in: ['stockholm'] } });
    });

    it('hard switch: resets completely when $or has multiple isnesses (no soft path)', () => {
        const f = mkFilter({ geo: {
            $or: [{ 'is--region': true }, { 'is--komun': true, 'region': { $in: ['stockholm'] } }]
        }});

        f.switchIsenssUsingLimitedStructure({ dim: 'geo', isness: 'is--country' });

        // Hard reset — all previous clauses gone
        expect(geo(f)).toEqual({ $or: [{ 'is--country': true }] });
    });

});
