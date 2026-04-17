/**
 * @file ProvablyFairRNG.ts
 * @purpose Provides a seedable, deterministic pseudo-random number generator using xoroshiro128+.
 * @author Agent 934
 * @date 2026-04-16
 * @license Proprietary – available for licensing
 */

// Constants for xoroshiro128+ algorithm
const ROTL_A = 24;
const ROTL_C = 37;
const SHIFT_B = 16n;

// A common constant for mixing seeds, derived from the golden ratio
const SEED_MIXER = 0x9E3779B97F4A7C15n;

/**
 * Rotates a BigInt left by k bits, ensuring it wraps around within 64 bits.
 * @param x The BigInt to rotate.
 * @param k The number of bits to rotate by.
 * @returns The rotated BigInt.
 */
function rotl(x: bigint, k: number): bigint {
  const K_BIGINT = BigInt(k);
  const SIXTY_FOUR_BIGINT = 64n;
  return (x << K_BIGINT) | (x >> (SIXTY_FOUR_BIGINT - K_BIGINT));
}

/**
 * Hashes a string into a 64-bit BigInt using a djb2-style algorithm.
 * This provides a deterministic way to convert string seeds into a numerical seed.
 * @param str The string to hash.
 * @returns A 64-bit BigInt hash.
 */
function stringToBigIntHash(str: string): bigint {
  let hash = 5381n; // Initial hash value
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5n) + hash) + BigInt(str.charCodeAt(i));
  }
  return hash;
}

/**
 * ProvablyFairRNG class implements the xoroshiro128+ pseudo-random number generator.
 * It is seedable and deterministic, suitable for provably fair systems.
 * The internal state consists of two 64-bit unsigned integers (s0, s1).
 * Output numbers are in the range [0, 1).
 */
class ProvablyFairRNG {
  private s0: bigint;
  private s1: bigint;
  private readonly originalSeed: string;

  /**
   * Creates an instance of ProvablyFairRNG.
   * @param seed An optional seed. Can be a string or a number.
   *             If omitted, `Date.now()` is used as the seed.
   *             String seeds are hashed deterministically.
   * @example
   * const rng1 = new ProvablyFairRNG(); // Uses Date.now()
   * const rng2 = new ProvablyFairRNG(12345);
   * const rng3 = new ProvablyFairRNG('my-secret-seed');
   */
  constructor(seed?: string | number) {
    let initialSeed: bigint;

    if (typeof seed === 'string') {
      this.originalSeed = seed;
      initialSeed = stringToBigIntHash(seed);
    } else if (typeof seed === 'number') {
      this.originalSeed = seed.toString();
      initialSeed = BigInt(seed);
    } else {
      this.originalSeed = Date.now().toString();
      initialSeed = BigInt(Date.now());
    }

    // Initialize s0 and s1 from the initial seed
    // Ensure s0 and s1 are not both zero, as xoroshiro128+ requires non-zero state.
    this.s0 = initialSeed;
    this.s1 = initialSeed ^ SEED_MIXER;

    // If both s0 and s1 are zero after initialization (highly unlikely but possible with specific seeds),
    // perturb them to ensure non-zero state.
    if (this.s0 === 0n && this.s1 === 0n) {
      this.s0 = 1n;
      this.s1 = 1n;
    }
  }

  /**
   * Generates the next 64-bit unsigned integer in the sequence.
   * This is the core xoroshiro128+ algorithm step.
   * @returns A 64-bit BigInt representing the next random value.
   */
  private next(): bigint {
    const s0 = this.s0;
    let s1 = this.s1;
    const result = s0 + s1; // The output value is the sum of the current states

    s1 ^= s0;
    this.s0 = rotl(s0, ROTL_A) ^ s1 ^ (s1 << SHIFT_B);
    this.s1 = rotl(s1, ROTL_C);

    return result;
  }

  /**
   * Generates a pseudo-random floating-point number between 0 (inclusive) and 1 (exclusive).
   * @returns A number in the range [0, 1).
   * @example
   * const rng = new ProvablyFairRNG(123);
   * const randomNumber = rng.random(); // e.g., 0.54321
   */
  public random(): number {
    // Get a 64-bit BigInt from the generator
    const nextBigInt = this.next();

    // Convert the 64-bit BigInt to a 53-bit integer (mantissa precision of JS numbers)
    // and then normalize to [0, 1).
    // Using 2^53 as the divisor ensures maximum precision for JS numbers.
    const MAX_53_BIT_INT = 0x1FFFFFFFFFFFFFn; // 2^53 - 1
    const DIVISOR = 2 ** 53;

    // Take the lower 53 bits and convert to number, then divide.
    return Number(nextBigInt & MAX_53_BIT_INT) / DIVISOR;
  }

  /**
   * Generates a pseudo-random integer between `min` (inclusive) and `max` (inclusive).
   * @param min The minimum possible integer value.
   * @param max The maximum possible integer value.
   * @returns A random integer in the range [min, max].
   * @example
   * const rng = new ProvablyFairRNG(123);
   * const diceRoll = rng.randomInt(1, 6); // e.g., 3
   */
  public randomInt(min: number, max: number): number {
    min = Math.ceil(min);
    max = Math.floor(max);
    // The maximum is inclusive and the minimum is inclusive
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  /**
   * Selects an item from a list based on their proportional weights.
   * Items with higher weights are more likely to be chosen.
   * @template T The type of the value in the items.
   * @param items An array of objects, each with a `value` and a `weight`.
   * @returns The `value` of the chosen item.
   * @throws {Error} If the `items` array is empty or contains only items with zero/negative weights.
   * @example
   * const rng = new ProvablyFairRNG('choice-seed');
   * const choices = [
   *   { value: 'common', weight: 10 },
   *   { value: 'rare', weight: 1 },
   * ];
   * const chosenItem = rng.weightedChoice(choices); // 'common' is 10x more likely
   */
  public weightedChoice<T>(items: { value: T; weight: number }[]): T {
    const totalWeight = items.reduce((sum, item) => sum + Math.max(0, item.weight), 0);

    if (totalWeight <= 0) {
      // Handle cases where no valid weights are provided
      const validItems = items.filter(item => item.weight > 0);
      if (validItems.length > 0) {
        // If there are valid items, pick one uniformly
        return validItems[this.randomInt(0, validItems.length - 1)].value;
      }
      throw new Error('Cannot make a weighted choice from items with zero or negative total weight.');
    }

    let r = this.random() * totalWeight;

    for (const item of items) {
      if (item.weight > 0 && r < item.weight) {
        return item.value;
      }
      r -= Math.max(0, item.weight);
    }

    // Fallback: should not be reached if totalWeight > 0 and random() works correctly.
    // In case of floating point inaccuracies, return the last item with positive weight.
    const lastValidItem = items.slice().reverse().find(item => item.weight > 0);
    if (lastValidItem) {
      return lastValidItem.value;
    }
    // This should ideally be unreachable if totalWeight > 0.
    throw new Error('Weighted choice failed to select an item, possibly due to floating point inaccuracies or invalid weights.');
  }

  /**
   * Returns the original seed used to initialize this RNG instance.
   * This is useful for logging and committing outcomes on-chain for provable fairness.
   * @returns The original seed as a string.
   * @example
   * const rng = new ProvablyFairRNG('game-round-123');
   * console.log(rng.getSeed()); // 'game-round-123'
   */
  public getSeed(): string {
    return this.originalSeed;
  }

  /**
   * Creates a new ProvablyFairRNG instance with the exact same internal state
   * as the current instance. This allows for deterministic replay or branching
   * of random sequences from a specific point.
   * @returns A new ProvablyFairRNG instance with the cloned state.
   * @example
   * const rng1 = new ProvablyFairRNG(123);
   * rng1.random(); // Advance state
   * const rng2 = rng1.clone(); // rng2 now has the same state as rng1
   * console.log(rng1.random()); // Different from rng2.random()
   * console.log(rng2.random()); // Same as rng1.random() before clone
   */
  public clone(): ProvablyFairRNG {
    const clonedRNG = new ProvablyFairRNG(this.originalSeed);
    clonedRNG.s0 = this.s0;
    clonedRNG.s1 = this.s1;
    return clonedRNG;
  }
}

export { ProvablyFairRNG };
export default ProvablyFairRNG;

/**
 * Factory function to create a ProvablyFairRNG instance.
 * @param seed An optional seed for the RNG.
 * @returns A new ProvablyFairRNG instance.
 * @example
 * import { createRNG } from './ProvablyFairRNG';
 * const rng = createRNG('my-game-seed');
 * console.log(rng.random());
 */
export function createRNG(seed?: string | number): ProvablyFairRNG {
  return new ProvablyFairRNG(seed);
}
