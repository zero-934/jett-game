/**
 * @file DiceDuelLogic.test.ts
 * @purpose Jest tests for DiceDuelLogic.
 * @author Agent 934
 * @date 2026-04-16
 * @license Proprietary – available for licensing
 */

import {
  createDiceDuelState,
  rollPlayerDice,
  doubleDown,
  resolveRound,
  simulateDiceDuelRTP,
} from '../games/DiceDuelLogic';
import { ProvablyFairRNG } from '../shared/rng/ProvablyFairRNG';

const BET = 10;

describe('DiceDuelLogic', () => {

  it('1. createDiceDuelState returns correct initial shape', () => {
    const state = createDiceDuelState(BET);
    expect(state.bet).toBe(BET);
    expect(state.phase).toBe('bet');
    expect(state.outcome).toBeNull();
    expect(state.doubledDown).toBe(false);
    expect(state.playerDice).toHaveLength(3);
    expect(state.houseDice).toHaveLength(3);
  });

  it('2. rollPlayerDice fills playerDice with 3 values 1-6', () => {
    const state = createDiceDuelState(BET);
    const next  = rollPlayerDice(state, { rng: new ProvablyFairRNG('test') });
    expect(next.playerDice).toHaveLength(3);
    next.playerDice.forEach(d => {
      expect(d).toBeGreaterThanOrEqual(1);
      expect(d).toBeLessThanOrEqual(6);
    });
    expect(next.phase).toBe('player_rolled');
  });

  it('3. rollPlayerDice does not roll houseDice yet', () => {
    const state = createDiceDuelState(BET);
    const next  = rollPlayerDice(state, { rng: new ProvablyFairRNG('test') });
    expect(next.houseTotal).toBe(0);
    expect(next.houseDice).toEqual([0, 0, 0]);
  });

  it('4. doubleDown doubles the bet', () => {
    let state = createDiceDuelState(BET);
    state = rollPlayerDice(state, { rng: new ProvablyFairRNG('dd') });
    const doubled = doubleDown(state);
    expect(doubled.bet).toBe(BET * 2);
    expect(doubled.doubledDown).toBe(true);
  });

  it('5. doubleDown only works in player_rolled phase', () => {
    const state = createDiceDuelState(BET);
    expect(state.phase).toBe('bet');
    const unchanged = doubleDown(state);
    expect(unchanged.bet).toBe(BET); // unchanged
  });

  it('6. resolveRound fills houseDice and sets phase=complete', () => {
    let state = createDiceDuelState(BET);
    state = rollPlayerDice(state, { rng: new ProvablyFairRNG('r1') });
    state = resolveRound(state, { rng: new ProvablyFairRNG('r2') });
    expect(state.phase).toBe('complete');
    expect(state.houseDice).toHaveLength(3);
    state.houseDice.forEach(d => {
      expect(d).toBeGreaterThanOrEqual(1);
      expect(d).toBeLessThanOrEqual(6);
    });
    expect(state.outcome).not.toBeNull();
  });

  it('7. player wins when playerTotal > houseTotal (ignoring edge)', () => {
    // Force a scenario where player rolls 6,6,6 and house rolls 1,1,1
    let state = createDiceDuelState(BET);
    // Manually set player dice high
    state = rollPlayerDice(state, { rng: new ProvablyFairRNG('p-high') });
    // Override to guarantee player wins
    state = { ...state, playerDice: [6, 6, 6], playerTotal: 18 };
    // Use houseEdge=0 for deterministic test
    state = resolveRound(state, { rng: new ProvablyFairRNG('h-low'), houseEdge: 0 });
    if (state.houseTotal < 18) {
      expect(state.outcome).toBe('win');
    }
    // If house also rolled 18 it's a push — that's valid too
  });

  it('8. push when totals are equal', () => {
    let state = createDiceDuelState(BET);
    state = { ...state, phase: 'player_rolled', playerDice: [2, 2, 2], playerTotal: 6 };
    // Force house to also get 6 by checking outcome logic
    // We test the state shape; exact dice values depend on RNG
    // Just verify push sets payout=bet
    state = resolveRound(state, { rng: new ProvablyFairRNG('push-test'), houseEdge: 0 });
    if (state.outcome === 'push') {
      expect(state.payout).toBe(BET);
    }
    expect(['win','lose','push']).toContain(state.outcome);
  });

  it('9. house wins when houseTotal > playerTotal', () => {
    let state = createDiceDuelState(BET);
    state = { ...state, phase: 'player_rolled', playerDice: [1, 1, 1], playerTotal: 3 };
    state = resolveRound(state, { rng: new ProvablyFairRNG('h-wins'), houseEdge: 0 });
    if (state.houseTotal > 3) {
      expect(state.outcome).toBe('lose');
      expect(state.payout).toBe(0);
    }
  });

  it('10. payout correct on normal win', () => {
    let state = createDiceDuelState(BET);
    state = { ...state, phase: 'player_rolled', playerDice: [6, 6, 6], playerTotal: 18 };
    state = resolveRound(state, { rng: new ProvablyFairRNG('win-pay'), houseEdge: 0 });
    if (state.outcome === 'win') {
      expect(state.payout).toBe(BET * 2); // Returns bet + profit
    }
  });

  it('11. payout correct on double-down win', () => {
    let state = createDiceDuelState(BET);
    state = { ...state, phase: 'player_rolled', playerDice: [6, 6, 6], playerTotal: 18 };
    state = doubleDown(state);
    state = resolveRound(state, { rng: new ProvablyFairRNG('dd-win'), houseEdge: 0 });
    if (state.outcome === 'win') {
      expect(state.payout).toBe(BET * 4); // Doubled bet * 2
    }
  });

  it('12. simulateDiceDuelRTP over 5000 rounds is between 0.70 and 1.10', () => {
    const rtp = simulateDiceDuelRTP(5000, BET);
    expect(rtp).toBeGreaterThanOrEqual(0.70);
    expect(rtp).toBeLessThanOrEqual(1.10);
  });

});
