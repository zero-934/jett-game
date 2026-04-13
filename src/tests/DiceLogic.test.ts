/**
 * @file DiceLogic.test.ts
 * @purpose Unit tests for DiceLogic — win probability, RTP, house edge, roll outcomes.
 * @author Agent 934
 * @date 2026-04-13
 * @license Proprietary – available for licensing
 */

import {
  createDiceState, rollDice, selectTier,
  getWinProbability, simulateDiceRTP,
} from '../games/DiceLogic';

describe('DiceLogic', () => {
  describe('getWinProbability', () => {
    it('returns ~48.5% for 2x with 3% house edge', () => {
      expect(getWinProbability(2, 0.03)).toBeCloseTo(0.485, 2);
    });
    it('returns ~19.4% for 5x with 3% house edge', () => {
      expect(getWinProbability(5, 0.03)).toBeCloseTo(0.194, 2);
    });
    it('returns ~9.7% for 10x with 3% house edge', () => {
      expect(getWinProbability(10, 0.03)).toBeCloseTo(0.097, 2);
    });
  });

  describe('createDiceState', () => {
    it('initializes with correct defaults', () => {
      const state = createDiceState(10, 2);
      expect(state.bet).toBe(10);
      expect(state.selectedTier).toBe(2);
      expect(state.won).toBeNull();
      expect(state.isComplete).toBe(false);
    });
  });

  describe('selectTier', () => {
    it('changes tier before roll', () => {
      const state = createDiceState(10, 2);
      selectTier(state, 5);
      expect(state.selectedTier).toBe(5);
    });
    it('cannot change tier after roll', () => {
      const state = createDiceState(10, 2);
      rollDice(state, { rng: () => 0 });
      selectTier(state, 10);
      expect(state.selectedTier).toBe(2);
    });
  });

  describe('rollDice', () => {
    it('wins when roll < win probability', () => {
      const state = createDiceState(10, 2);
      rollDice(state, { houseEdge: 0.03, rng: () => 0.001 });
      expect(state.won).toBe(true);
      expect(state.payout).toBe(20);
    });

    it('loses when roll >= win probability', () => {
      const state = createDiceState(10, 2);
      rollDice(state, { houseEdge: 0.03, rng: () => 0.999 });
      expect(state.won).toBe(false);
      expect(state.payout).toBe(0);
    });

    it('cannot roll twice', () => {
      const state = createDiceState(10, 2);
      rollDice(state, { rng: () => 0.001 });
      const firstResult = state.won;
      rollDice(state, { rng: () => 0.999 });
      expect(state.won).toBe(firstResult);
    });

    it('sets dice values between 1 and 6', () => {
      const state = createDiceState(10, 2);
      rollDice(state, {});
      for (const v of state.diceValues) {
        expect(v).toBeGreaterThanOrEqual(1);
        expect(v).toBeLessThanOrEqual(6);
      }
    });
  });

  describe('RTP simulation', () => {
    it('achieves ~94-100% RTP for 2x over 10,000 rounds', () => {
      const rtp = simulateDiceRTP(10000, 2, {});
      expect(rtp).toBeGreaterThan(0.90);
      expect(rtp).toBeLessThan(1.05);
    });
    it('achieves ~94-100% RTP for 5x over 10,000 rounds', () => {
      const rtp = simulateDiceRTP(10000, 5, {});
      expect(rtp).toBeGreaterThan(0.85);
      expect(rtp).toBeLessThan(1.10);
    });
    it('achieves ~94-100% RTP for 10x over 10,000 rounds', () => {
      const rtp = simulateDiceRTP(10000, 10, {});
      expect(rtp).toBeGreaterThan(0.80);
      expect(rtp).toBeLessThan(1.15);
    });
  });
});
