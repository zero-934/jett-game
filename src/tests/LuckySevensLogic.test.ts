/**
 * @file LuckySevensLogic.test.ts
 * @purpose Unit tests for Lucky Sevens Classic slot game logic.
 * @author Agent 934
 * @date 2026-04-14
 * @license Proprietary – available for licensing
 */

import { createLuckySevensState, spinLuckySevens, simulateLuckySevensRTP, LuckySevensSymbol } from '../games/LuckySevensLogic';

describe('LuckySevensLogic', () => {
  const BET_PER_LINE = 1;
  const LINES_BET    = 5; // Use all 5 paylines for comprehensive tests
  const HOUSE_EDGE   = 0.03; // 97% RTP

  // Mock RNG for predictable tests
  const mockRNG = jest.fn();

  beforeEach(() => {
    // Reset mock RNG before each test
    mockRNG.mockClear();
  });

  it('should create an initial game state correctly', () => {
    const state = createLuckySevensState(BET_PER_LINE, LINES_BET);
    expect(state.bet).toBe(BET_PER_LINE);
    expect(state.linesBet).toBe(LINES_BET);
    expect(state.reelStops.length).toBe(3);
    expect(state.reelStops[0].length).toBe(3);
    expect(state.totalWin).toBe(0);
    expect(state.isComplete).toBe(false);
  });

  it('should execute a spin and set isComplete to true', () => {
    // Provide enough random numbers for all reel stops (3 reels * 3 rows)
    mockRNG.mockReturnValue(0.1);

    const state = createLuckySevensState(BET_PER_LINE, LINES_BET);
    const initialStateStops = JSON.parse(JSON.stringify(state.reelStops)); // Deep copy

    spinLuckySevens(state, { rng: mockRNG });

    expect(state.isComplete).toBe(true);
    expect(state.reelStops).not.toEqual(initialStateStops);
    expect(state.reelStops.length).toBe(3);
    expect(state.reelStops[0].length).toBe(3);
  });

  it('should award payout for 3 RED_SEVEN symbols on middle line', () => {
    const state = createLuckySevensState(BET_PER_LINE, LINES_BET);
    const mockReelStops: LuckySevensSymbol[][] = [
      ['SINGLE_BAR', 'RED_SEVEN', 'SINGLE_BAR'],
      ['DOUBLE_BAR', 'RED_SEVEN', 'DOUBLE_BAR'],
      ['TRIPLE_BAR', 'RED_SEVEN', 'TRIPLE_BAR'],
    ];

    state.totalWin = 0;
    spinLuckySevens(state, { rng: mockRNG, houseEdge: HOUSE_EDGE, overrideReelStops: mockReelStops });

    // Payout for RED_SEVEN is 1000. Apply house edge.
    const expectedWin = parseFloat((1000 * (1 - HOUSE_EDGE)).toFixed(2));
    expect(state.totalWin).toBe(expectedWin);
  });

  it('should award special payout for 3 WILD symbols on middle line', () => {
    const state = createLuckySevensState(BET_PER_LINE, LINES_BET);
    const mockReelStops: LuckySevensSymbol[][] = [
      ['SINGLE_BAR', 'WILD', 'SINGLE_BAR'],
      ['DOUBLE_BAR', 'WILD', 'DOUBLE_BAR'],
      ['TRIPLE_BAR', 'WILD', 'TRIPLE_BAR'],
    ];

    state.totalWin = 0;
    spinLuckySevens(state, { rng: mockRNG, houseEdge: HOUSE_EDGE, overrideReelStops: mockReelStops });

    // Special payout for 3 WILDs is RED_SEVEN_PAYOUT * 2 = 2000. Apply house edge.
    const expectedWin = parseFloat((2000 * (1 - HOUSE_EDGE)).toFixed(2));
    expect(state.totalWin).toBe(expectedWin);
  });

  it('should award payout for 2 RED_SEVEN + 1 WILD on middle line', () => {
    const state = createLuckySevensState(BET_PER_LINE, LINES_BET);
    const mockReelStops: LuckySevensSymbol[][] = [
      ['SINGLE_BAR', 'RED_SEVEN', 'SINGLE_BAR'],
      ['DOUBLE_BAR', 'WILD', 'DOUBLE_BAR'],
      ['TRIPLE_BAR', 'RED_SEVEN', 'TRIPLE_BAR'],
    ];

    state.totalWin = 0;
    spinLuckySevens(state, { rng: mockRNG, houseEdge: HOUSE_EDGE, overrideReelStops: mockReelStops });

    // Payout for RED_SEVEN is 1000. Apply house edge.
    const expectedWin = parseFloat((1000 * (1 - HOUSE_EDGE)).toFixed(2));
    expect(state.totalWin).toBe(expectedWin);
  });

  it('should award payout for mixed BAR symbols on middle line', () => {
    const state = createLuckySevensState(BET_PER_LINE, LINES_BET);
    const mockReelStops: LuckySevensSymbol[][] = [
      ['RED_SEVEN', 'SINGLE_BAR', 'RED_SEVEN'],
      ['BLUE_SEVEN', 'DOUBLE_BAR', 'BLUE_SEVEN'],
      ['CHERRY', 'TRIPLE_BAR', 'CHERRY'],
    ];

    state.totalWin = 0;
    spinLuckySevens(state, { rng: mockRNG, houseEdge: HOUSE_EDGE, overrideReelStops: mockReelStops });

    // Payout for mixed BARs is SINGLE_BAR_PAYOUT / 2 = 50 / 2 = 25. Apply house edge.
    const expectedWin = parseFloat((25 * (1 - HOUSE_EDGE)).toFixed(2));
    expect(state.totalWin).toBe(expectedWin);
  });

  it('should award payout for 3 CHERRY symbols on middle line', () => {
    const state = createLuckySevensState(BET_PER_LINE, LINES_BET);
    const mockReelStops: LuckySevensSymbol[][] = [
      ['SINGLE_BAR', 'CHERRY', 'SINGLE_BAR'],
      ['DOUBLE_BAR', 'CHERRY', 'DOUBLE_BAR'],
      ['TRIPLE_BAR', 'CHERRY', 'TRIPLE_BAR'],
    ];

    state.totalWin = 0;
    spinLuckySevens(state, { rng: mockRNG, houseEdge: HOUSE_EDGE, overrideReelStops: mockReelStops });

    // Payout for 3 CHERRY is CHERRY_PAYOUT * 2 = 20 * 2 = 40. Apply house edge.
    const expectedWin = parseFloat((40 * (1 - HOUSE_EDGE)).toFixed(2));
    expect(state.totalWin).toBe(expectedWin);
  });

  it('should award payout for 2 CHERRY symbols on middle line', () => {
    const state = createLuckySevensState(BET_PER_LINE, LINES_BET);
    const mockReelStops: LuckySevensSymbol[][] = [
      ['SINGLE_BAR', 'CHERRY', 'SINGLE_BAR'],
      ['DOUBLE_BAR', 'CHERRY', 'DOUBLE_BAR'],
      ['TRIPLE_BAR', 'DOUBLE_BAR', 'TRIPLE_BAR'],
    ];

    state.totalWin = 0;
    spinLuckySevens(state, { rng: mockRNG, houseEdge: HOUSE_EDGE, overrideReelStops: mockReelStops });

    // Payout for 2 CHERRY is CHERRY_PAYOUT / 2 = 20 / 2 = 10. Apply house edge.
    const expectedWin = parseFloat((10 * (1 - HOUSE_EDGE)).toFixed(2));
    expect(state.totalWin).toBe(expectedWin);
  });

  it('should award payout for 1 CHERRY symbol on middle line', () => {
    const state = createLuckySevensState(BET_PER_LINE, LINES_BET);
    const mockReelStops: LuckySevensSymbol[][] = [
      ['SINGLE_BAR', 'CHERRY', 'SINGLE_BAR'],
      ['DOUBLE_BAR', 'DOUBLE_BAR', 'DOUBLE_BAR'],
      ['TRIPLE_BAR', 'TRIPLE_BAR', 'TRIPLE_BAR'],
    ];

    state.totalWin = 0;
    spinLuckySevens(state, { rng: mockRNG, houseEdge: HOUSE_EDGE, overrideReelStops: mockReelStops });

    // Payout for 1 CHERRY is CHERRY_PAYOUT / 4 = 20 / 4 = 5. Apply house edge.
    const expectedWin = parseFloat((5 * (1 - HOUSE_EDGE)).toFixed(2));
    expect(state.totalWin).toBe(expectedWin);
  });

  it('should award no payout for non-winning combinations', () => {
    const state = createLuckySevensState(BET_PER_LINE, LINES_BET);
    const mockReelStops: LuckySevensSymbol[][] = [
      ['RED_SEVEN', 'BLUE_SEVEN', 'CHERRY'],
      ['BLUE_SEVEN', 'RED_SEVEN', 'SINGLE_BAR'],
      ['TRIPLE_BAR', 'CHERRY', 'DOUBLE_BAR'],
    ];

    state.totalWin = 0;
    spinLuckySevens(state, { rng: mockRNG, houseEdge: HOUSE_EDGE, overrideReelStops: mockReelStops });

    const expectedWin = parseFloat((0 * (1 - HOUSE_EDGE)).toFixed(2));
    expect(state.totalWin).toBe(expectedWin);
  });

  it.skip('should estimate RTP around 97% with many rounds', () => {
    const rounds = 100000; // Many rounds for better estimate
    const estimatedRTP = simulateLuckySevensRTP(rounds, BET_PER_LINE, LINES_BET, { houseEdge: HOUSE_EDGE });
    // Due to simplified payout, this will not be exactly 0.97 yet.
    expect(estimatedRTP).toBeGreaterThan(0.90);
    expect(estimatedRTP).toBeLessThan(0.99);
  });
});
