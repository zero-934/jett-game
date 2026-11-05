/**
 * @file rng.char.test.ts
 * @purpose CHARACTERIZATION TESTS for src/shared/rng/ProvablyFairRNG.ts (research only).
 * @author Agent 934 (research branch)
 * @date 2026-11-05
 * @license Proprietary – available for licensing
 */
import { ProvablyFairRNG as Production, RNG_ALGORITHM_LEGACY_V1 } from '../../src/shared/rng/ProvablyFairRNG';

// polish-003: production now defaults to xoroshiro128plus-v2. The defect characterizations below
// target the retained legacy-v1 algorithm explicitly; corrected regressions live in src/tests.
class Current extends Production { constructor(seed?: string | number) { super(seed, { algorithm: RNG_ALGORITHM_LEGACY_V1 }); } }
import { ProvablyFairRNG as Masked } from '../../research/patches/ProvablyFairRNG.masked';

type Internals = { s0: bigint; s1: bigint };

describe('ProvablyFairRNG characterization', () => {
  test('[CURRENT-DEFECT] state grows without bound (~37 bits per call)', () => {
    const r = new Current(1) as unknown as Internals & { random(): number };
    for (let i = 0; i < 1000; i++) r.random();
    expect(r.s1.toString(2).length).toBeGreaterThan(30000);
  });

  test('[CURRENT-DEFECT] nearby millisecond seeds produce near-identical first values', () => {
    const v = [0, 1, 2, 3].map((d) => new Current(1730000000000 + d).random());
    expect(Math.max(...v) - Math.min(...v)).toBeLessThan(1e-3); // a uniform RNG would spread ~0.5
  });

  test('[FIXED in polish-003] state export exists and round-trips through JSON', () => {
    const r = new Production('seed'); r.random();
    const copy = Production.fromState(JSON.parse(JSON.stringify(r.getState())));
    expect(copy.random()).toBe(r.random());
  });

  test('proposed masked RNG: bounded state, distinct first values, checkpoint round-trip', () => {
    const r = new Masked(1) as unknown as Internals & { random(): number };
    for (let i = 0; i < 10000; i++) r.random();
    expect(r.s0.toString(2).length).toBeLessThanOrEqual(64);
    const v = [0, 1, 2, 3].map((d) => new Masked(1730000000000 + d).random());
    expect(new Set(v).size).toBe(4);
    const a = new Masked('replay'); for (let i = 0; i < 37; i++) a.random();
    const snap = JSON.parse(JSON.stringify(a.getState()));
    const b = new Masked('other'); b.setState(snap);
    for (let i = 0; i < 100; i++) expect(b.random()).toBe(a.random());
  });

  test('proposed masked RNG: uniformity smoke check (10 buckets, 100k draws, chi-square < 30)', () => {
    const r = new Masked('uniform');
    const buckets = new Array(10).fill(0);
    for (let i = 0; i < 100000; i++) buckets[Math.floor(r.random() * 10)]++;
    const chi = buckets.reduce((s, o) => s + ((o - 10000) ** 2) / 10000, 0);
    expect(chi).toBeLessThan(30); // df=9, p≈0.0005 critical value ≈ 29.7
  });
});
