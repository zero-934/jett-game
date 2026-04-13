/**
 * @file MinesLogic.test.ts
 * @purpose Unit tests for MinesLogic — bomb placement, tile reveal, multiplier, RTP.
 * @author Agent 934
 * @date 2026-04-13
 * @license Proprietary – available for licensing
 */

import {
  createMinesState, revealTile, cashOutMines,
  computeMinesMultiplier, simulateMinesRTP,
} from '../games/MinesLogic';

describe('MinesLogic', () => {
  describe('createMinesState', () => {
    it('places the correct number of bombs', () => {
      const state = createMinesState(10, 5);
      const bombCount = state.grid.filter(t => t.hasBomb).length;
      expect(bombCount).toBe(5);
    });

    it('initializes all tiles as hidden', () => {
      const state = createMinesState(10, 3);
      expect(state.grid.every(t => t.state === 'hidden')).toBe(true);
    });

    it('starts with multiplier 1.0', () => {
      const state = createMinesState(10, 5);
      expect(state.multiplier).toBe(1.0);
      expect(state.tilesRevealed).toBe(0);
    });
  });

  describe('computeMinesMultiplier', () => {
    it('returns 1.0 at 0 reveals', () => {
      expect(computeMinesMultiplier(0, 5, 0.03)).toBe(1.0);
    });
    it('increases with each safe reveal', () => {
      const m1 = computeMinesMultiplier(1, 5, 0.03);
      const m3 = computeMinesMultiplier(3, 5, 0.03);
      expect(m3).toBeGreaterThan(m1);
    });
    it('applies house edge', () => {
      const with_edge    = computeMinesMultiplier(3, 5, 0.03);
      const without_edge = computeMinesMultiplier(3, 5, 0);
      expect(with_edge).toBeLessThan(without_edge);
    });
  });

  describe('revealTile', () => {
    it('marks safe tile as safe and increases multiplier', () => {
      // Force all tiles to be safe by placing 0 bombs (use rng that never places bombs)
      const state = createMinesState(10, 3, { rng: () => 0.99 });
      // Find a safe tile
      const safeTile = state.grid.find(t => !t.hasBomb);
      if (!safeTile) return;
      revealTile(state, safeTile.index, {});
      expect(safeTile.state).toBe('safe');
      expect(state.tilesRevealed).toBe(1);
      expect(state.multiplier).toBeGreaterThan(1.0);
    });

    it('ends game on bomb reveal', () => {
      const state = createMinesState(10, 5);
      const bombTile = state.grid.find(t => t.hasBomb);
      if (!bombTile) return;
      revealTile(state, bombTile.index, {});
      expect(state.isAlive).toBe(false);
      expect(state.payout).toBe(0);
    });

    it('does nothing when game is over', () => {
      const state = createMinesState(10, 5);
      state.isAlive = false;
      const before = state.tilesRevealed;
      const safeTile = state.grid.find(t => !t.hasBomb);
      if (safeTile) revealTile(state, safeTile.index, {});
      expect(state.tilesRevealed).toBe(before);
    });

    it('cannot reveal same tile twice', () => {
      const state = createMinesState(10, 3);
      const safeTile = state.grid.find(t => !t.hasBomb);
      if (!safeTile) return;
      revealTile(state, safeTile.index, {});
      const countAfterFirst = state.tilesRevealed;
      revealTile(state, safeTile.index, {});
      expect(state.tilesRevealed).toBe(countAfterFirst);
    });
  });

  describe('cashOutMines', () => {
    it('returns 0 before any reveal', () => {
      const state = createMinesState(10, 5);
      expect(cashOutMines(state)).toBe(0);
    });

    it('pays out correctly after reveals', () => {
      const state = createMinesState(10, 3, { rng: () => 0.99 });
      const safeTile = state.grid.find(t => !t.hasBomb);
      if (!safeTile) return;
      revealTile(state, safeTile.index, {});
      const payout = cashOutMines(state);
      expect(payout).toBeCloseTo(10 * state.multiplier, 1);
      expect(state.cashedOut).toBe(true);
    });

    it('returns 0 on second cash-out', () => {
      const state = createMinesState(10, 3, { rng: () => 0.99 });
      const safeTile = state.grid.find(t => !t.hasBomb);
      if (!safeTile) return;
      revealTile(state, safeTile.index, {});
      cashOutMines(state);
      expect(cashOutMines(state)).toBe(0);
    });
  });

  describe('RTP simulation', () => {
    it('achieves sane RTP revealing 2 tiles with 5 bombs', () => {
      const rtp = simulateMinesRTP(10000, 5, 2, {});
      expect(rtp).toBeGreaterThan(0.5);
      expect(rtp).toBeLessThan(1.5);
    });
  });
});
