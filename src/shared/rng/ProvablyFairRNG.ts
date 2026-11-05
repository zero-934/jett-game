/**
 * @file ProvablyFairRNG.ts
 * @purpose Seedable, deterministic pseudo-random number generator.
 *          Default algorithm `xoroshiro128plus-v2`: xoroshiro128+ (24/16/37) with all state
 *          masked to unsigned 64 bits, SplitMix64 seeding and 53-bit output from the high bits.
 *          The original implementation is retained as `legacy-v1` for old seeded fixtures only:
 *          it never masked state (state grows ~37 bits per call) and is not xoroshiro128+.
 *
 *          NOTE: despite the class name, this is a client-side deterministic PRNG. It is not a
 *          provably fair protocol and not cryptographically secure. Outcomes are replayable from
 *          the seed, which is exactly why it must never decide real-value outcomes on a client.
 * @author Agent 934
 * @date 2026-04-16 (v2: 2026-11-05)
 * @license Proprietary – available for licensing
 */
// Part of Jett Casino — raising $500k pre-seed. Contact: zero60851@gmail.com

/** Identifier of the corrected generator. Recorded in replays. */
export const RNG_ALGORITHM_V2 = 'xoroshiro128plus-v2' as const;
/** Identifier of the original, unmasked generator (kept for legacy seeded fixtures). */
export const RNG_ALGORITHM_LEGACY_V1 = 'legacy-v1' as const;
/** Supported algorithm identifiers. */
export type RNGAlgorithm = typeof RNG_ALGORITHM_V2 | typeof RNG_ALGORITHM_LEGACY_V1;

/** Options for {@link ProvablyFairRNG}. */
export interface RNGOptions {
  /** Algorithm to use. Defaults to {@link RNG_ALGORITHM_V2}. */
  algorithm?: RNGAlgorithm;
}

/** JSON-safe snapshot of generator state for checkpoints and replays. */
export interface RNGStateSnapshot {
  algorithm: RNGAlgorithm;
  seed: string;
  /** s0 as lowercase hex (no prefix). */
  s0: string;
  /** s1 as lowercase hex (no prefix). */
  s1: string;
}

const MASK64 = (1n << 64n) - 1n;
const ROTL_A = 24n;
const ROTL_C = 37n;
const SHIFT_B = 16n;
const SPLITMIX_GAMMA = 0x9E3779B97F4A7C15n;
const SPLITMIX_MUL_1 = 0xBF58476D1CE4E5B9n;
const SPLITMIX_MUL_2 = 0x94D049BB133111EBn;
const HIGH_53_SHIFT = 11n;
const TWO_POW_53 = 2 ** 53;
const DJB2_INITIAL = 5381n;

// Legacy constants (unchanged behaviour)
const LEGACY_ROTL_A = 24;
const LEGACY_ROTL_C = 37;
const LEGACY_SEED_MIXER = 0x9E3779B97F4A7C15n;
const LEGACY_MAX_53_BIT_INT = 0x1FFFFFFFFFFFFFn;

function rotl64(x: bigint, k: bigint): bigint {
  return ((x << k) | (x >> (64n - k))) & MASK64;
}

/** Original rotation without masking. Retained verbatim for legacy-v1. */
function legacyRotl(x: bigint, k: number): bigint {
  const K_BIGINT = BigInt(k);
  return (x << K_BIGINT) | (x >> (64n - K_BIGINT));
}

/** Original unmasked djb2 hash (legacy-v1 seeding). */
function legacyStringHash(str: string): bigint {
  let hash = DJB2_INITIAL;
  for (let i = 0; i < str.length; i++) hash = ((hash << 5n) + hash) + BigInt(str.charCodeAt(i));
  return hash;
}

/** djb2 reduced modulo 2^64 (v2 seeding). */
function stringHash64(str: string): bigint {
  let hash = DJB2_INITIAL;
  for (let i = 0; i < str.length; i++) hash = (((hash << 5n) + hash) + BigInt(str.charCodeAt(i))) & MASK64;
  return hash;
}

/** One SplitMix64 step; mutates `state.v`. */
function splitMix64(state: { v: bigint }): bigint {
  state.v = (state.v + SPLITMIX_GAMMA) & MASK64;
  let z = state.v;
  z = ((z ^ (z >> 30n)) * SPLITMIX_MUL_1) & MASK64;
  z = ((z ^ (z >> 27n)) * SPLITMIX_MUL_2) & MASK64;
  return z ^ (z >> 31n);
}

/**
 * Creates a fresh seed string from the platform CSPRNG when available, else from the clock.
 * The seed is recorded so a demo round can be replayed; it is not a secret.
 *
 * @returns A 16-hex-digit seed string.
 * @example
 * const seed = createSeedString(); // e.g. '9f2c0a7d41be6e03'
 */
export function createSeedString(): string {
  const cryptoObj = (globalThis as { crypto?: { getRandomValues?: (a: Uint32Array) => Uint32Array } }).crypto;
  if (cryptoObj?.getRandomValues) {
    const words = cryptoObj.getRandomValues(new Uint32Array(2));
    return words[0].toString(16).padStart(8, '0') + words[1].toString(16).padStart(8, '0');
  }
  return Date.now().toString(16).padStart(16, '0');
}

/**
 * ProvablyFairRNG — seedable deterministic PRNG. Output range is [0, 1).
 */
class ProvablyFairRNG {
  private s0: bigint;
  private s1: bigint;
  private readonly originalSeed: string;
  private readonly algorithm: RNGAlgorithm;

  /**
   * @param seed - String or number seed. Omitted: a fresh seed from {@link createSeedString}
   *               (v2) or `Date.now()` (legacy-v1).
   * @param options - Algorithm selection.
   * @example
   * const rng = new ProvablyFairRNG('round-42');
   * const legacy = new ProvablyFairRNG('win_seed_1', { algorithm: 'legacy-v1' });
   */
  constructor(seed?: string | number, options: RNGOptions = {}) {
    this.algorithm = options.algorithm ?? RNG_ALGORITHM_V2;

    if (this.algorithm === RNG_ALGORITHM_LEGACY_V1) {
      let initialSeed: bigint;
      if (typeof seed === 'string') { this.originalSeed = seed; initialSeed = legacyStringHash(seed); }
      else if (typeof seed === 'number') { this.originalSeed = seed.toString(); initialSeed = BigInt(seed); }
      else { this.originalSeed = Date.now().toString(); initialSeed = BigInt(this.originalSeed); }
      this.s0 = initialSeed;
      this.s1 = initialSeed ^ LEGACY_SEED_MIXER;
      if (this.s0 === 0n && this.s1 === 0n) { this.s0 = 1n; this.s1 = 1n; }
      return;
    }

    let seed64: bigint;
    if (typeof seed === 'string') { this.originalSeed = seed; seed64 = stringHash64(seed); }
    else if (typeof seed === 'number') { this.originalSeed = seed.toString(); seed64 = BigInt.asUintN(64, BigInt(Math.trunc(seed))); }
    else { this.originalSeed = createSeedString(); seed64 = stringHash64(this.originalSeed); }
    const sm = { v: seed64 };
    this.s0 = splitMix64(sm);
    this.s1 = splitMix64(sm);
    if (this.s0 === 0n && this.s1 === 0n) this.s1 = 1n;
  }

  /** Core step: returns the next 64-bit output. */
  private next(): bigint {
    if (this.algorithm === RNG_ALGORITHM_LEGACY_V1) {
      const s0 = this.s0;
      let s1 = this.s1;
      const result = s0 + s1;
      s1 ^= s0;
      this.s0 = legacyRotl(s0, LEGACY_ROTL_A) ^ s1 ^ (s1 << SHIFT_B);
      this.s1 = legacyRotl(s1, LEGACY_ROTL_C);
      return result;
    }
    const s0 = this.s0;
    let s1 = this.s1;
    const result = (s0 + s1) & MASK64;
    s1 ^= s0;
    this.s0 = rotl64(s0, ROTL_A) ^ s1 ^ ((s1 << SHIFT_B) & MASK64);
    this.s1 = rotl64(s1, ROTL_C);
    return result;
  }

  /**
   * Next float in [0, 1).
   * @returns A number in [0, 1).
   * @example
   * new ProvablyFairRNG(123).random();
   */
  public random(): number {
    const value = this.next();
    if (this.algorithm === RNG_ALGORITHM_LEGACY_V1) return Number(value & LEGACY_MAX_53_BIT_INT) / TWO_POW_53;
    return Number(value >> HIGH_53_SHIFT) / TWO_POW_53;
  }

  /**
   * Random integer in [min, max] inclusive.
   * @param min - Minimum.
   * @param max - Maximum.
   * @returns Integer in range.
   * @example
   * new ProvablyFairRNG(1).randomInt(1, 6);
   */
  public randomInt(min: number, max: number): number {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  /**
   * Weighted choice among items.
   * @param items - Items with weights.
   * @returns Chosen value.
   * @throws If no item has positive weight.
   * @example
   * rng.weightedChoice([{ value: 'a', weight: 1 }, { value: 'b', weight: 3 }]);
   */
  public weightedChoice<T>(items: { value: T; weight: number }[]): T {
    const totalWeight = items.reduce((sum, item) => sum + Math.max(0, item.weight), 0);
    if (totalWeight <= 0) {
      const validItems = items.filter(item => item.weight > 0);
      if (validItems.length > 0) return validItems[this.randomInt(0, validItems.length - 1)].value;
      throw new Error('Cannot make a weighted choice from items with zero or negative total weight.');
    }
    let r = this.random() * totalWeight;
    for (const item of items) {
      if (item.weight > 0 && r < item.weight) return item.value;
      r -= Math.max(0, item.weight);
    }
    const lastValidItem = items.slice().reverse().find(item => item.weight > 0);
    if (lastValidItem) return lastValidItem.value;
    throw new Error('Weighted choice failed to select an item, possibly due to floating point inaccuracies or invalid weights.');
  }

  /**
   * @returns The original seed as a string.
   * @example
   * new ProvablyFairRNG('x').getSeed(); // 'x'
   */
  public getSeed(): string {
    return this.originalSeed;
  }

  /**
   * @returns The algorithm identifier, for replay headers.
   * @example
   * new ProvablyFairRNG('x').getAlgorithm(); // 'xoroshiro128plus-v2'
   */
  public getAlgorithm(): RNGAlgorithm {
    return this.algorithm;
  }

  /**
   * Copy with identical state.
   * @returns A new instance continuing the same sequence.
   * @example
   * const copy = rng.clone();
   */
  public clone(): ProvablyFairRNG {
    const cloned = new ProvablyFairRNG(this.originalSeed, { algorithm: this.algorithm });
    cloned.s0 = this.s0;
    cloned.s1 = this.s1;
    return cloned;
  }

  /**
   * JSON-safe state snapshot.
   * @returns Snapshot that {@link setState} or {@link ProvablyFairRNG.fromState} accept.
   * @example
   * const snap = rng.getState();
   */
  public getState(): RNGStateSnapshot {
    return { algorithm: this.algorithm, seed: this.originalSeed, s0: this.s0.toString(16), s1: this.s1.toString(16) };
  }

  /**
   * Restores a snapshot taken from an instance of the same algorithm.
   * @param snapshot - Snapshot from {@link getState}.
   * @throws If the snapshot's algorithm differs.
   * @example
   * rng.setState(snap);
   */
  public setState(snapshot: RNGStateSnapshot): void {
    if (snapshot.algorithm !== this.algorithm) {
      throw new Error(`RNG algorithm mismatch: snapshot ${snapshot.algorithm}, instance ${this.algorithm}`);
    }
    const s0 = BigInt('0x' + snapshot.s0);
    const s1 = BigInt('0x' + snapshot.s1);
    this.s0 = this.algorithm === RNG_ALGORITHM_V2 ? s0 & MASK64 : s0;
    this.s1 = this.algorithm === RNG_ALGORITHM_V2 ? s1 & MASK64 : s1;
  }

  /**
   * Creates an instance from a snapshot.
   * @param snapshot - Snapshot from {@link getState}.
   * @returns Instance continuing from the snapshot.
   * @example
   * const restored = ProvablyFairRNG.fromState(snap);
   */
  public static fromState(snapshot: RNGStateSnapshot): ProvablyFairRNG {
    const rng = new ProvablyFairRNG(snapshot.seed, { algorithm: snapshot.algorithm });
    rng.setState(snapshot);
    return rng;
  }
}

export { ProvablyFairRNG };
export default ProvablyFairRNG;

/**
 * Factory for {@link ProvablyFairRNG}.
 * @param seed - Optional seed.
 * @param options - Optional algorithm selection.
 * @returns A new instance.
 * @example
 * const rng = createRNG('my-game-seed');
 */
export function createRNG(seed?: string | number, options?: RNGOptions): ProvablyFairRNG {
  return new ProvablyFairRNG(seed, options);
}
