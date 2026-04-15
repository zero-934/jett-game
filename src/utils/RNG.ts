/**
 * @file RNG.ts
 * @purpose Provides a simple seedable random number generator utility.
 *          This can be swapped out for a more robust crypto-grade RNG for production.
 * @author C-3PO
 * @date 2026-04-14
 * @license Proprietary – available for licensing
 */

/**
 * A simple pseudo-random number generator (PRNG) that can be seeded.
 * Implements a LCG (Linear Congruential Generator).
 * Not cryptographically secure; for game logic only.
 *
 * @param seed - The initial seed for the generator.
 * @returns A function that returns a new random number (0-1) each time it's called.
 */
export function createSeedableRNG(seed: number): () => number {
  // LCG parameters (constants from Numerical Recipes)
  const m = 0x80000000; // 2**31
  const a = 1103515245;
  const c = 12345;

  let state = seed || Math.floor(Math.random() * (m - 1)); // Use provided seed or a random one

  return function() {
    state = (a * state + c) % m;
    return state / (m - 1);
  };
}

/**
 * Returns a non-seedable random number generator (using Math.random).
 * Provided for compatibility with game logic expecting an RNG function, but without seedability.
 *
 * @returns A function that returns a new random number (0-1) each time it's called.
 */
export function getRandomSeedableRNG(): () => number {
  return Math.random;
}
