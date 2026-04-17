/**
 * @file ProvablyFairRNG.test.ts
 * @purpose Jest test suite for the ProvablyFairRNG class.
 * @author Agent 934
 * @date 2026-04-16
 * @license Proprietary – available for licensing
 */

import { ProvablyFairRNG } from '../shared/rng/ProvablyFairRNG';

describe('ProvablyFairRNG', () => {
  it('1. Deterministic: two instances with same seed produce identical sequences for 100 calls', () => {
    const seed = 'test-seed-123';
    const rng1 = new ProvablyFairRNG(seed);
    const rng2 = new ProvablyFairRNG(seed);

    const sequence1: number[] = [];
    const sequence2: number[] = [];

    for (let i = 0; i < 100; i++) {
      sequence1.push(rng1.random());
      sequence2.push(rng2.random());
    }

    expect(sequence1).toEqual(sequence2);
  });

  it('2. Different seeds produce different sequences', () => {
    const seed1 = 'test-seed-1';
    const seed2 = 'test-seed-2';
    const rng1 = new ProvablyFairRNG(seed1);
    const rng2 = new ProvablyFairRNG(seed2);

    const sequence1: number[] = [];
    const sequence2: number[] = [];

    for (let i = 0; i < 10; i++) { // Fewer calls are enough to show difference
      sequence1.push(rng1.random());
      sequence2.push(rng2.random());
    }

    expect(sequence1).not.toEqual(sequence2);
  });

  it('3. random() always returns a float in [0, 1)', () => {
    const rng = new ProvablyFairRNG('range-test');
    for (let i = 0; i < 1000; i++) {
      const num = rng.random();
      expect(num).toBeGreaterThanOrEqual(0);
      expect(num).toBeLessThan(1);
    }
  });

  it('4. randomInt(min, max) always in range, is integer, works with min==max', () => {
    const rng = new ProvablyFairRNG('random-int-test');
    const samples = 1000;

    // Test positive range
    const min1 = 1;
    const max1 = 10;
    for (let i = 0; i < samples; i++) {
      const num = rng.randomInt(min1, max1);
      expect(num).toBeGreaterThanOrEqual(min1);
      expect(num).toBeLessThanOrEqual(max1);
      expect(Number.isInteger(num)).toBe(true);
    }

    // Test negative range
    const min2 = -5;
    const max2 = 5;
    for (let i = 0; i < samples; i++) {
      const num = rng.randomInt(min2, max2);
      expect(num).toBeGreaterThanOrEqual(min2);
      expect(num).toBeLessThanOrEqual(max2);
      expect(Number.isInteger(num)).toBe(true);
    }

    // Test min == max
    const fixedNum = 7;
    for (let i = 0; i < samples; i++) {
      const num = rng.randomInt(fixedNum, fixedNum);
      expect(num).toBe(fixedNum);
      expect(Number.isInteger(num)).toBe(true);
    }
  });

  it('5. weightedChoice: item with weight 0 is never chosen; item with weight 100 vs weight 1 is chosen ~99% of the time', () => {
    const rng = new ProvablyFairRNG('weighted-choice-distribution-test');
    const items = [
      { value: 'A', weight: 1 },
      { value: 'B', weight: 100 },
      { value: 'C', weight: 0 }, // Should never be chosen
      { value: 'D', weight: -5 }, // Should never be chosen
    ];

    const counts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
    const samples = 10000;

    for (let i = 0; i < samples; i++) {
      const choice = rng.weightedChoice(items);
      counts[choice]++;
    }

    // 'C' and 'D' should never be chosen
    expect(counts['C']).toBe(0);
    expect(counts['D']).toBe(0);

    // 'B' should be chosen approximately 100 times more often than 'A'
    // Total effective weight = 1 + 100 = 101
    // A expected: 1/101 * samples
    // B expected: 100/101 * samples
    const expectedA = (1 / 101) * samples;
    const expectedB = (100 / 101) * samples;

    // Allow for some statistical variance (e.g., +/- 15% for A, +/- 5% for B)
    expect(counts['A']).toBeGreaterThan(expectedA * 0.75);
    expect(counts['A']).toBeLessThan(expectedA * 1.25);
    expect(counts['B']).toBeGreaterThan(expectedB * 0.95);
    expect(counts['B']).toBeLessThan(expectedB * 1.05);

    // Test with all zero/negative weights
    const zeroWeightItems = [{ value: 'X', weight: 0 }, { value: 'Y', weight: -1 }];
    expect(() => rng.weightedChoice(zeroWeightItems)).toThrow('Cannot make a weighted choice from items with zero or negative total weight.');

    // Test with only one positive weight
    const singleItem = [{ value: 'Z', weight: 10 }];
    for (let i = 0; i < 100; i++) {
      expect(rng.weightedChoice(singleItem)).toBe('Z');
    }
  });

  it('6. getSeed() returns a string', () => {
    const seedString = 'my-custom-seed';
    const rng1 = new ProvablyFairRNG(seedString);
    expect(rng1.getSeed()).toBe(seedString);
    expect(typeof rng1.getSeed()).toBe('string');

    const seedNumber = 45678;
    const rng2 = new ProvablyFairRNG(seedNumber);
    expect(rng2.getSeed()).toBe(seedNumber.toString());
    expect(typeof rng2.getSeed()).toBe('string');

    const rng3 = new ProvablyFairRNG(); // Uses Date.now()
    expect(typeof rng3.getSeed()).toBe('string');
    expect(rng3.getSeed()).not.toBe('');
  });

  it('7. clone() produces same subsequent values as original at point of cloning', () => {
    const rngOriginal = new ProvablyFairRNG('clone-test-seed');

    // Advance original RNG a few times
    rngOriginal.random();
    rngOriginal.randomInt(1, 10);

    // Clone the RNG
    const rngClone = rngOriginal.clone();

    // Get next values from both
    const originalNext1 = rngOriginal.random();
    const cloneNext1 = rngClone.random();

    expect(originalNext1).toBe(cloneNext1);

    const originalNext2 = rngOriginal.randomInt(1, 100);
    const cloneNext2 = rngClone.randomInt(1, 100);

    expect(originalNext2).toBe(cloneNext2);

    // Ensure they continue to produce the same sequence
    for (let i = 0; i < 50; i++) {
      expect(rngOriginal.random()).toBe(rngClone.random());
    }
  });
});
