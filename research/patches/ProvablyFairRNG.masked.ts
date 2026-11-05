/**
 * @file ProvablyFairRNG.masked.ts
 * @purpose PROPOSED FIX (review-only, not wired into production). Drop-in replacement for
 *          src/shared/rng/ProvablyFairRNG.ts that keeps the public API but:
 *            1. masks all state to unsigned 64 bits (true xoroshiro128+),
 *            2. mixes seeds with SplitMix64 so nearby seeds diverge,
 *            3. uses the high 53 bits (xoroshiro128+ low bits are weak),
 *            4. exposes getState()/setState() for checkpoint/restore.
 *          NOTE: output sequences differ from the current implementation for the same seed.
 * @author Agent 934 (research branch)
 * @date 2026-11-05
 * @license Proprietary – available for licensing
 */

const MASK64 = (1n << 64n) - 1n;
const ROTL_A = 24n;
const ROTL_C = 37n;
const SHIFT_B = 16n;
const SPLITMIX_GAMMA = 0x9E3779B97F4A7C15n;
const TWO_POW_53 = 2 ** 53;

function rotl(x: bigint, k: bigint): bigint {
  return ((x << k) | (x >> (64n - k))) & MASK64;
}

function splitMix64(state: { v: bigint }): bigint {
  state.v = (state.v + SPLITMIX_GAMMA) & MASK64;
  let z = state.v;
  z = ((z ^ (z >> 30n)) * 0xBF58476D1CE4E5B9n) & MASK64;
  z = ((z ^ (z >> 27n)) * 0x94D049BB133111EBn) & MASK64;
  return z ^ (z >> 31n);
}

function stringToBigIntHash(str: string): bigint {
  let hash = 5381n;
  for (let i = 0; i < str.length; i++) hash = (((hash << 5n) + hash) + BigInt(str.charCodeAt(i))) & MASK64;
  return hash;
}

/** Serializable RNG state (hex strings so it survives JSON). */
export interface RNGStateSnapshot { version: 1; seed: string; s0: string; s1: string; }

class ProvablyFairRNG {
  private s0: bigint;
  private s1: bigint;
  private readonly originalSeed: string;

  constructor(seed?: string | number) {
    let initialSeed: bigint;
    if (typeof seed === 'string') { this.originalSeed = seed; initialSeed = stringToBigIntHash(seed); }
    else if (typeof seed === 'number') { this.originalSeed = seed.toString(); initialSeed = BigInt.asUintN(64, BigInt(Math.trunc(seed))); }
    else { const now = Date.now(); this.originalSeed = now.toString(); initialSeed = BigInt(now); }
    const sm = { v: initialSeed & MASK64 };
    this.s0 = splitMix64(sm);
    this.s1 = splitMix64(sm);
    if (this.s0 === 0n && this.s1 === 0n) this.s1 = 1n;
  }

  private next(): bigint {
    const s0 = this.s0;
    let s1 = this.s1;
    const result = (s0 + s1) & MASK64;
    s1 ^= s0;
    this.s0 = rotl(s0, ROTL_A) ^ s1 ^ ((s1 << SHIFT_B) & MASK64);
    this.s1 = rotl(s1, ROTL_C);
    return result;
  }

  public random(): number { return Number(this.next() >> 11n) / TWO_POW_53; }

  public randomInt(min: number, max: number): number {
    min = Math.ceil(min); max = Math.floor(max);
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  public weightedChoice<T>(items: { value: T; weight: number }[]): T {
    const totalWeight = items.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
    if (totalWeight <= 0) throw new Error('Cannot make a weighted choice from items with zero or negative total weight.');
    let r = this.random() * totalWeight;
    for (const item of items) { if (item.weight > 0 && r < item.weight) return item.value; r -= Math.max(0, item.weight); }
    const last = items.slice().reverse().find(item => item.weight > 0);
    if (last) return last.value;
    throw new Error('Weighted choice failed.');
  }

  public getSeed(): string { return this.originalSeed; }

  public clone(): ProvablyFairRNG {
    const c = new ProvablyFairRNG(this.originalSeed);
    c.s0 = this.s0; c.s1 = this.s1;
    return c;
  }

  /** Snapshot for checkpoint/replay. */
  public getState(): RNGStateSnapshot {
    return { version: 1, seed: this.originalSeed, s0: this.s0.toString(16), s1: this.s1.toString(16) };
  }

  /** Restores a snapshot produced by getState(). */
  public setState(snap: RNGStateSnapshot): void {
    if (snap.version !== 1) throw new Error(`Unsupported RNG snapshot version ${snap.version}`);
    this.s0 = BigInt('0x' + snap.s0) & MASK64;
    this.s1 = BigInt('0x' + snap.s1) & MASK64;
  }
}

export { ProvablyFairRNG };
export default ProvablyFairRNG;
export function createRNG(seed?: string | number): ProvablyFairRNG { return new ProvablyFairRNG(seed); }
