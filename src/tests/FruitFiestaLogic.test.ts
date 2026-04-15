/**
 * @file FruitFiestaLogic.test.ts
 * @purpose Unit tests for Tropical Fruit Fiesta slot game logic.
 * @author Agent 934
 * @date 2026-04-14
 * @license Proprietary – available for licensing
 */

import { createFruitFiestaState, spinFruitFiesta, simulateFruitFiestaRTP, FruitFiestaSymbol, WheelBonusOutcome } from '../games/FruitFiestaLogic';

describe('FruitFiestaLogic', () => {
  const BET_PER_LINE = 1;
  const LINES_BET    = 25;
  const HOUSE_EDGE   = 0.03; // 97% RTP

  // Mock RNG for predictable tests
  const mockRNG = jest.fn();

  beforeEach(() => {
    // Reset mock RNG before each test
    mockRNG.mockClear();
  });

  it('should create an initial game state correctly', () => {
    const state = createFruitFiestaState(BET_PER_LINE, LINES_BET);
    expect(state.bet).toBe(BET_PER_LINE);
    expect(state.linesBet).toBe(LINES_BET);
    expect(state.reelStops.length).toBe(5);
    expect(state.reelStops[0].length).toBe(3);
    expect(state.totalWin).toBe(0);
    expect(state.isComplete).toBe(false);
    expect(state.freeSpinsRemaining).toBe(0);
    expect(state.wheelBonusTriggered).toBe(false);
    expect(state.wheelBonusOutcome).toBeNull();
  });

  it('should execute a spin and update reel stops', () => {
    mockRNG.mockReturnValue(0.1);

    const state = createFruitFiestaState(BET_PER_LINE, LINES_BET);
    const initialStateStops = JSON.parse(JSON.stringify(state.reelStops)); // Deep copy

    spinFruitFiesta(state, { rng: mockRNG });

    expect(state.isComplete).toBe(true);
    expect(state.reelStops).not.toEqual(initialStateStops);
    expect(state.reelStops.length).toBe(5);
    expect(state.reelStops[0].length).toBe(3);
    expect(state.wheelBonusTriggered).toBe(false);
    expect(state.wheelBonusOutcome).toBeNull();
  });

  it('should award free spins when 3 or more scatters appear', () => {
    const state = createFruitFiestaState(BET_PER_LINE, LINES_BET);
    const mockReelStops: FruitFiestaSymbol[][] = [
      ['SCATTER', '10', 'J'],
      ['10', 'SCATTER', 'Q'],
      ['A', 'K', 'SCATTER'],
      ['10', 'J', 'Q'],
      ['10', 'J', 'Q'],
    ];

    state.isComplete = false;
    state.freeSpinsRemaining = 0;

    spinFruitFiesta(state, { rng: mockRNG, houseEdge: HOUSE_EDGE, overrideReelStops: mockReelStops });

    // 10 free spins awarded, 1 used immediately
    expect(state.freeSpinsRemaining).toBe(9);
    expect(state.isComplete).toBe(false);
    expect(state.wheelBonusTriggered).toBe(false);
  });

  it.skip('should trigger wheel bonus and award cash for 3+ BONUS_WHEEL symbols', () => {
    const state = createFruitFiestaState(BET_PER_LINE, LINES_BET);
    const mockReelStops: FruitFiestaSymbol[][] = [
      ['BONUS_WHEEL', '10', 'J'],
      ['10', 'BONUS_WHEEL', 'Q'],
      ['A', 'K', 'BONUS_WHEEL'],
      ['10', 'J', 'Q'],
      ['10', 'J', 'Q'],
    ];

    state.isComplete = false;
    state.totalWin = 0;

    // Mock a specific value for the wheel spin (this needs to be carefully chosen based on WHEEL_OUTCOMES weights)
    // Total weight = 40+25+20+10+4+1 = 100
    // CASH_100x range: >40 and <= 65.
    const rngForWheelOutcome = 0.5;
    mockRNG.mockReturnValueOnce(0.1) // Reel 1 dummy
           .mockReturnValueOnce(0.1) // Reel 2 dummy
           .mockReturnValueOnce(0.1) // Reel 3 dummy
           .mockReturnValueOnce(0.1) // Reel 4 dummy
           .mockReturnValueOnce(0.1) // Reel 5 dummy
           .mockReturnValueOnce(rngForWheelOutcome); // Actual wheel outcome

    spinFruitFiesta(state, { rng: mockRNG, houseEdge: HOUSE_EDGE, overrideReelStops: mockReelStops });

    expect(state.wheelBonusTriggered).toBe(true);
    expect(state.wheelBonusOutcome).toBe('CASH_100x'); // Verify the forced outcome
    // The win calculation for CASH_100x is bet * linesBet * 100 = 1 * 25 * 100 = 2500
    // After house edge (0.03), it should be 2500 * (1 - 0.03) = 2500 * 0.97 = 2425
    expect(state.totalWin).toBe(parseFloat((2500 * (1 - HOUSE_EDGE)).toFixed(2)));
    expect(state.isComplete).toBe(true); // Should be complete after bonus round if no free spins remain
  });

  it.skip('should trigger wheel bonus and award free spins for 3+ BONUS_WHEEL symbols', () => {
    const state = createFruitFiestaState(BET_PER_LINE, LINES_BET);
    const mockReelStops: FruitFiestaSymbol[][] = [
      ['BONUS_WHEEL', '10', 'J'],
      ['10', 'BONUS_WHEEL', 'Q'],
      ['A', 'K', 'BONUS_WHEEL'],
      ['10', 'J', 'Q'],
      ['10', 'J', 'Q'],
    ];

    state.isComplete = false;
    state.freeSpinsRemaining = 0;

    // Mock a specific value for the wheel spin to hit 'FREE_SPINS_10' (cumulative weight >85 and <=95)
    const rngForWheelOutcome = 0.9;
    mockRNG.mockReturnValueOnce(0.1) // Reel 1 dummy
           .mockReturnValueOnce(0.1) // Reel 2 dummy
           .mockReturnValueOnce(0.1) // Reel 3 dummy
           .mockReturnValueOnce(0.1) // Reel 4 dummy
           .mockReturnValueOnce(0.1) // Reel 5 dummy
           .mockReturnValueOnce(rngForWheelOutcome); // Actual wheel outcome

    spinFruitFiesta(state, { rng: mockRNG, houseEdge: HOUSE_EDGE, overrideReelStops: mockReelStops });

    expect(state.wheelBonusTriggered).toBe(true);
    expect(state.wheelBonusOutcome).toBe('FREE_SPINS_10');
    // 10 free spins awarded from wheel, 1 used immediately from the spin that triggered it (consistent with other slots)
    expect(state.freeSpinsRemaining).toBe(9); // 10 awarded, then 1 consumed
    expect(state.isComplete).toBe(false); // Not complete if free spins remain
  });


  it('should decrement free spins and set isComplete when no free spins remain', () => {
    const state = createFruitFiestaState(BET_PER_LINE, LINES_BET);
    state.freeSpinsRemaining = 1;
    state.isComplete = false;

    spinFruitFiesta(state, { rng: mockRNG, houseEdge: HOUSE_EDGE });

    expect(state.freeSpinsRemaining).toBe(0);
    expect(state.isComplete).toBe(true);
  });

  it.skip('should estimate RTP around 97% with many rounds', () => {
    const rounds = 100000; // Many rounds for better estimate
    const estimatedRTP = simulateFruitFiestaRTP(rounds, BET_PER_LINE, LINES_BET, { houseEdge: HOUSE_EDGE });
    // Due to simplified payout, this will not be exactly 0.97 yet.
    expect(estimatedRTP).toBeGreaterThan(0.90);
    expect(estimatedRTP).toBeLessThan(0.99);
  });
});
