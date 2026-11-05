/**
 * @file rng-growth.probe.ts
 * @purpose Research probe (NOT production): measures ProvablyFairRNG internal BigInt state growth
 *          and per-call cost, versus a correctly 64-bit-masked reference xoroshiro128+.
 * Run: npx ts-node? -> we use jest runner: npx jest --config research/jest.research.cjs rng-growth
 */
import { ProvablyFairRNG } from '../../src/shared/rng/ProvablyFairRNG';

const MASK64 = (1n << 64n) - 1n;
function refRotl(x: bigint, k: bigint): bigint { return ((x << k) | (x >> (64n - k))) & MASK64; }
class RefXoroshiro {
  s0: bigint; s1: bigint;
  constructor(s0: bigint, s1: bigint) { this.s0 = s0 & MASK64; this.s1 = s1 & MASK64; }
  next(): bigint {
    const s0 = this.s0; let s1 = this.s1;
    const r = (s0 + s1) & MASK64;
    s1 ^= s0;
    this.s0 = (refRotl(s0, 24n) ^ s1 ^ ((s1 << 16n) & MASK64)) & MASK64;
    this.s1 = refRotl(s1, 37n);
    return r;
  }
}

test('ProvablyFairRNG state growth and cost', () => {
  const rng = new ProvablyFairRNG(12345) as unknown as { s0: bigint; s1: bigint; random(): number };
  const rows: string[] = [];
  let calls = 0;
  for (const target of [0, 10, 100, 1000, 5000, 10000, 20000]) {
    while (calls < target) { rng.random(); calls++; }
    const t0 = performance.now();
    for (let i = 0; i < 200; i++) rng.random();
    calls += 200;
    const us = ((performance.now() - t0) / 200) * 1000;
    rows.push(`calls=${String(target).padStart(6)}  s0.bits=${rng.s0.toString(2).length.toString().padStart(8)}  s1.bits=${rng.s1.toString(2).length.toString().padStart(8)}  cost/call=${us.toFixed(1)}us`);
  }
  // Reference comparison of first outputs: does the repo match true xoroshiro128+?
  const a = new ProvablyFairRNG(12345) as unknown as { s0: bigint; s1: bigint; next(): bigint };
  const ref = new RefXoroshiro(a.s0, a.s1);
  const firstDiff: number[] = [];
  for (let i = 0; i < 50; i++) { if (((a.next() as bigint) & MASK64) !== ref.next()) firstDiff.push(i); }
  rows.push(`first output index differing from masked reference: ${firstDiff[0] ?? 'none in 50'}`);
  // Same-millisecond seeding collision
  const n1 = new ProvablyFairRNG(1730000000000), n2 = new ProvablyFairRNG(1730000000000);
  rows.push(`identical seeds -> identical first value: ${n1.random() === n2.random()}`);
  // Low-entropy: first value for consecutive ms seeds
  const v = [0,1,2,3].map(d => new ProvablyFairRNG(1730000000000 + d).random().toFixed(6));
  rows.push(`first values for consecutive-ms seeds: ${v.join(', ')}`);
  console.log(rows.join('\n'));
  expect(rows.length).toBeGreaterThan(0);
});
