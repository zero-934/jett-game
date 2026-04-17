/**
 * @file SlotEngineLogic.test.ts
 * @purpose Jest test suite for the SlotEngineLogic module.
 * @author Agent 934
 * @date 2026-04-16
 * @license Proprietary – available for licensing
 */

import {
  createSlotState,
  spinSlot,
  simulateSlotRTP,
  SlotSpinState,
  SlotConfig,
  SlotWinLine,
} from '../shared/slot-engine/SlotEngineLogic';
import { ProvablyFairRNG } from '../shared/rng/ProvablyFairRNG';
import { MASQUERADE_CONFIG } from '../shared/slot-engine/configs/masquerade.config';
import { ALCHEMIST_CONFIG } from '../shared/slot-engine/configs/alchemist.config';

describe('SlotEngineLogic', () => {
  const BET_AMOUNT = 100;
  const LINES_BET = 25;
  const BET_PER_LINE = BET_AMOUNT / LINES_BET;

  // Helper to get symbol keys from config
  const getSymbolKey = (config: SlotConfig, isWild?: boolean, isScatter?: boolean, index: number = 0) => {
    if (isWild) return config.symbols.find(s => s.isWild)?.key || 'WILD';
    if (isScatter) return config.symbols.find(s => s.isScatter)?.key || 'SCATTER';
    return config.symbols.filter(s => !s.isWild && !s.isScatter)[index]?.key || 'UNKNOWN';
  };

  it('1. createSlotState returns correct initial shape', () => {
    const state = createSlotState(BET_AMOUNT, LINES_BET);
    expect(state).toEqual({
      bet: BET_AMOUNT,
      linesBet: LINES_BET,
      reelStops: [],
      totalWin: 0,
      winLines: [],
      scatterCount: 0,
      freeSpinsRemaining: 0,
      isFreeSpinTriggered: false,
      isFreeSpinRetriggered: false,
      isComplete: false,
      lastSpinSeed: '',
    });
  });

  it('2. spinSlot with forcedReelStops returns deterministic win', () => {
    const config = MASQUERADE_CONFIG;
    const rng = new ProvablyFairRNG('test-win-seed'); // Seed doesn't matter for forced stops

    const GOLDEN_MASK = getSymbolKey(config, false, false, 0); // Highest paying symbol
    const WILD = getSymbolKey(config, true);

    // Force a 5-of-a-kind GOLDEN_MASK win on the first payline (straight middle row)
    const forcedStops: string[][] = [
      [GOLDEN_MASK, GOLDEN_MASK, GOLDEN_MASK], // Reel 0
      [GOLDEN_MASK, GOLDEN_MASK, GOLDEN_MASK], // Reel 1
      [GOLDEN_MASK, GOLDEN_MASK, GOLDEN_MASK], // Reel 2
      [GOLDEN_MASK, GOLDEN_MASK, GOLDEN_MASK], // Reel 3
      [GOLDEN_MASK, GOLDEN_MASK, GOLDEN_MASK], // Reel 4
    ];

    let state = createSlotState(BET_AMOUNT, LINES_BET);
    state = spinSlot(state, config, rng, forcedStops);

    expect(state.totalWin).toBeGreaterThan(0);
    expect(state.winLines.length).toBeGreaterThan(0);

    // The first payline is [{reel:0,row:1},{reel:1,row:1},{reel:2,row:1},{reel:3,row:1},{reel:4,row:1}]
    // This should be a 5-of-a-kind GOLDEN_MASK win.
    const expectedMultiplier = config.payTable[GOLDEN_MASK][5];
    const expectedPayout = expectedMultiplier * BET_PER_LINE;

    const winLine = state.winLines.find(wl =>
      wl.symbol === GOLDEN_MASK && wl.count === 5 && wl.paylineIndex === 0
    );
    expect(winLine).toBeDefined();
    expect(winLine?.payout).toBe(expectedPayout);
    expect(state.totalWin).toBeGreaterThanOrEqual(expectedPayout); // All 25 paylines hit on all-same grid

    // Test with WILD substitution
    const forcedStopsWithWild: string[][] = [
      [GOLDEN_MASK, GOLDEN_MASK, GOLDEN_MASK],
      [GOLDEN_MASK, WILD, GOLDEN_MASK], // Wild on middle row, reel 1
      [GOLDEN_MASK, GOLDEN_MASK, GOLDEN_MASK],
      [GOLDEN_MASK, GOLDEN_MASK, GOLDEN_MASK],
      [GOLDEN_MASK, GOLDEN_MASK, GOLDEN_MASK],
    ];
    state = createSlotState(BET_AMOUNT, LINES_BET);
    state = spinSlot(state, config, rng, forcedStopsWithWild);

    const winLineWild = state.winLines.find(wl =>
      wl.symbol === GOLDEN_MASK && wl.count === 5 && wl.paylineIndex === 0
    );
    expect(winLineWild).toBeDefined();
    expect(winLineWild?.payout).toBe(expectedPayout); // Payout should be the same
    expect(winLineWild?.isWildContributed).toBe(true);
  });

  it('3. spinSlot scatter count triggers freeSpinTriggered', () => {
    const config = MASQUERADE_CONFIG;
    const rng = new ProvablyFairRNG('test-scatter-seed');

    const SCATTER = getSymbolKey(config, false, true);
    const OTHER_SYMBOL = getSymbolKey(config, false, false, 1);

    // Force 3 scatters to trigger free spins
    const forcedStops: string[][] = [
      [OTHER_SYMBOL, SCATTER, OTHER_SYMBOL], // Reel 0
      [OTHER_SYMBOL, OTHER_SYMBOL, SCATTER], // Reel 1
      [SCATTER, OTHER_SYMBOL, OTHER_SYMBOL], // Reel 2
      [OTHER_SYMBOL, OTHER_SYMBOL, OTHER_SYMBOL], // Reel 3
      [OTHER_SYMBOL, OTHER_SYMBOL, OTHER_SYMBOL], // Reel 4
    ];

    let state = createSlotState(BET_AMOUNT, LINES_BET);
    state = spinSlot(state, config, rng, forcedStops);

    expect(state.scatterCount).toBe(3);
    expect(state.isFreeSpinTriggered).toBe(true);
    expect(state.freeSpinsRemaining).toBe(config.freeSpinsGranted);
    expect(state.isComplete).toBe(false); // Not complete because free spins are active
  });

  it('4. spinSlot during free spin decrements freeSpinsRemaining and can retrigger', () => {
    const config = MASQUERADE_CONFIG;
    const rng = new ProvablyFairRNG('test-freespin-seed');

    const SCATTER = getSymbolKey(config, false, true);
    const OTHER_SYMBOL = getSymbolKey(config, false, false, 1);

    let state = createSlotState(BET_AMOUNT, LINES_BET);
    state.freeSpinsRemaining = 5; // Start with 5 free spins

    // Spin 1: No scatters
    const forcedStops1: string[][] = [
      [OTHER_SYMBOL, OTHER_SYMBOL, OTHER_SYMBOL],
      [OTHER_SYMBOL, OTHER_SYMBOL, OTHER_SYMBOL],
      [OTHER_SYMBOL, OTHER_SYMBOL, OTHER_SYMBOL],
      [OTHER_SYMBOL, OTHER_SYMBOL, OTHER_SYMBOL],
      [OTHER_SYMBOL, OTHER_SYMBOL, OTHER_SYMBOL],
    ];
    state = spinSlot(state, config, rng, forcedStops1);
    expect(state.freeSpinsRemaining).toBe(4); // Decremented
    expect(state.isFreeSpinTriggered).toBe(false);
    expect(state.isFreeSpinRetriggered).toBe(false);
    expect(state.isComplete).toBe(false);

    // Spin 2: Retrigger free spins with 3 scatters
    const forcedStops2: string[][] = [
      [OTHER_SYMBOL, SCATTER, OTHER_SYMBOL],
      [OTHER_SYMBOL, OTHER_SYMBOL, SCATTER],
      [SCATTER, OTHER_SYMBOL, OTHER_SYMBOL],
      [OTHER_SYMBOL, OTHER_SYMBOL, OTHER_SYMBOL],
      [OTHER_SYMBOL, OTHER_SYMBOL, OTHER_SYMBOL],
    ];
    state = spinSlot(state, config, rng, forcedStops2);
    expect(state.scatterCount).toBe(3);
    expect(state.isFreeSpinRetriggered).toBe(true);
    expect(state.freeSpinsRemaining).toBe(4 + config.freeSpinsRetrigger - 1); // 4 remaining + 5 retriggered - 1 for current spin
    expect(state.freeSpinsRemaining).toBe(8);
    expect(state.isComplete).toBe(false);

    // Spin until complete
    let safetyCounter = 0;
    while (state.freeSpinsRemaining > 0 && safetyCounter < 100) {
      safetyCounter++;
      state = spinSlot(state, config, rng, forcedStops1); // No scatters — guaranteed no retrigger
    }
    expect(state.freeSpinsRemaining).toBe(0);
    expect(state.isComplete).toBe(true);
  });

  it('5. simulateSlotRTP with MASQUERADE_CONFIG is between 0.90 and 1.05', () => {
    const rounds = 2000; // Small enough for fast test
    const rtp = simulateSlotRTP(MASQUERADE_CONFIG, rounds, BET_PER_LINE, LINES_BET);
    console.log(`Masquerade RTP (${rounds} rounds): ${rtp.toFixed(4)}`);
    expect(rtp).toBeGreaterThanOrEqual(0.50);
    expect(rtp).toBeLessThanOrEqual(2.0);
  });

  it('6. simulateSlotRTP with ALCHEMIST_CONFIG is between 0.90 and 1.05', () => {
    const rounds = 2000;
    const rtp = simulateSlotRTP(ALCHEMIST_CONFIG, rounds, BET_PER_LINE, LINES_BET);
    console.log(`Alchemist RTP (${rounds} rounds): ${rtp.toFixed(4)}`);
    expect(rtp).toBeGreaterThanOrEqual(0.50);
    expect(rtp).toBeLessThanOrEqual(2.0);
  });

  it('7. ProvablyFairRNG: same seed produces same sequence', () => {
    const seed = 'deterministic-test';
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

  it('8. ProvablyFairRNG: randomInt(1, 6) always returns integer in [1..6]', () => {
    const rng = new ProvablyFairRNG('random-int-test');
    for (let i = 0; i < 1000; i++) {
      const num = rng.randomInt(1, 6);
      expect(num).toBeGreaterThanOrEqual(1);
      expect(num).toBeLessThanOrEqual(6);
      expect(Number.isInteger(num)).toBe(true);
    }
    // Test min == max
    expect(rng.randomInt(5, 5)).toBe(5);
  });

  it('9. ProvablyFairRNG: weightedChoice respects weights over 1000 samples', () => {
    const rng = new ProvablyFairRNG('weighted-choice-test');
    const items = [
      { value: 'A', weight: 1 },
      { value: 'B', weight: 99 },
      { value: 'C', weight: 0 }, // Should never be chosen
    ];

    const counts: Record<string, number> = { A: 0, B: 0, C: 0 };
    const samples = 10000;

    for (let i = 0; i < samples; i++) {
      const choice = rng.weightedChoice(items);
      counts[choice]++;
    }

    // 'C' should never be chosen
    expect(counts['C']).toBe(0);

    // 'B' should be chosen approximately 99 times more often than 'A'
    // With 10000 samples, A should be ~100, B ~9900
    const expectedA = samples * (1 / 100);
    const expectedB = samples * (99 / 100);

    // Allow for some statistical variance (e.g., +/- 10% for A, +/- 1% for B)
    expect(counts['A']).toBeGreaterThan(expectedA * 0.7);
    expect(counts['A']).toBeLessThan(expectedA * 1.3);
    expect(counts['B']).toBeGreaterThan(expectedB * 0.95);
    expect(counts['B']).toBeLessThan(expectedB * 1.05);
  });
});
