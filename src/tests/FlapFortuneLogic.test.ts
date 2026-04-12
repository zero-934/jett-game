/**
 * @file FlapFortuneLogic.test.ts
 * @purpose Unit tests for FlapFortuneLogic — verifies physics, pipe generation,
 *          collision detection, cash-out, and RTP behavior.
 * @author Agent 934
 * @date 2026-04-12
 * @license Proprietary – available for licensing
 */

import {
  createFlapFortuneState,
  tickFlapFortune,
  generateFlapPipe,
  computeFlapMultiplier,
  cashOutFlapFortune,
  checkFlapCollision,
} from '../games/FlapFortuneLogic';

const BASE_CONFIG = { worldWidth: 390, worldHeight: 844 };

describe('FlapFortuneLogic', () => {
  describe('createFlapFortuneState', () => {
    it('initializes with correct defaults', () => {
      const state = createFlapFortuneState(10, BASE_CONFIG);
      expect(state.bet).toBe(10);
      expect(state.multiplier).toBe(1.0);
      expect(state.pipesCleared).toBe(0);
      expect(state.isAlive).toBe(true);
      expect(state.cashedOut).toBe(false);
      expect(state.pipes).toHaveLength(1);
    });
  });

  describe('computeFlapMultiplier', () => {
    it('returns 1.0 at zero pipes', () => {
      expect(computeFlapMultiplier(0, 0.03)).toBe(1.0);
    });

    it('increases with each pipe cleared', () => {
      const m1 = computeFlapMultiplier(1, 0.03);
      const m5 = computeFlapMultiplier(5, 0.03);
      expect(m5).toBeGreaterThan(m1);
    });

    it('applies house edge', () => {
      const withEdge = computeFlapMultiplier(5, 0.03);
      const noEdge = computeFlapMultiplier(5, 0);
      expect(withEdge).toBeLessThan(noEdge);
    });
  });

  describe('generateFlapPipe', () => {
    it('generates a pipe with positive heights', () => {
      const pipe = generateFlapPipe(400, BASE_CONFIG);
      expect(pipe.topHeight).toBeGreaterThan(0);
      expect(pipe.bottomHeight).toBeGreaterThan(0);
      expect(pipe.cleared).toBe(false);
    });

    it('top + gap + bottom roughly equals world height', () => {
      const gapHeight = 180;
      const pipe = generateFlapPipe(400, { ...BASE_CONFIG, pipeGapHeight: gapHeight });
      const total = pipe.topHeight + gapHeight + pipe.bottomHeight;
      expect(Math.abs(total - BASE_CONFIG.worldHeight)).toBeLessThan(2);
    });
  });

  describe('checkFlapCollision', () => {
    it('detects top pipe collision', () => {
      const state = createFlapFortuneState(10, BASE_CONFIG);
      state.playerY = 20; // very top
      state.pipes = [{ x: 55, topHeight: 200, bottomHeight: 400, cleared: false }];
      // player top = 20 - 15 = 5 <= topHeight 200 → collision
      expect(checkFlapCollision(state, BASE_CONFIG)).toBe(true);
    });

    it('detects bottom pipe collision', () => {
      const state = createFlapFortuneState(10, BASE_CONFIG);
      state.playerY = 830; // very bottom
      state.pipes = [{ x: 55, topHeight: 100, bottomHeight: 200, cleared: false }];
      expect(checkFlapCollision(state, BASE_CONFIG)).toBe(true);
    });

    it('returns false in the gap', () => {
      const state = createFlapFortuneState(10, BASE_CONFIG);
      state.playerY = 422; // roughly mid-world
      // Pipe at x=55 (overlaps player at x=80), wide gap
      state.pipes = [{ x: 55, topHeight: 100, bottomHeight: 100, cleared: false }];
      // gap = 844 - 100 - 100 = 644. Player at y=422 is safely in gap.
      expect(checkFlapCollision(state, BASE_CONFIG)).toBe(false);
    });
  });

  describe('cashOutFlapFortune', () => {
    it('returns bet * multiplier', () => {
      const state = createFlapFortuneState(10, BASE_CONFIG);
      state.pipesCleared = 3;
      state.multiplier = computeFlapMultiplier(3, 0.03);
      const payout = cashOutFlapFortune(state);
      expect(payout).toBeCloseTo(10 * state.multiplier, 2);
      expect(state.cashedOut).toBe(true);
    });

    it('returns 0 on second cash-out', () => {
      const state = createFlapFortuneState(10, BASE_CONFIG);
      cashOutFlapFortune(state);
      expect(cashOutFlapFortune(state)).toBe(0);
    });
  });

  describe('tickFlapFortune - gravity', () => {
    it('applies gravity (velocity increases downward)', () => {
      const config = { ...BASE_CONFIG, gravity: 0.5 };
      const state = createFlapFortuneState(10, config);
      const startY = state.playerY;
      // No flap — should fall
      tickFlapFortune(state, false, config);
      tickFlapFortune(state, false, config);
      expect(state.playerY).toBeGreaterThan(startY);
    });

    it('flap temporarily reverses downward motion', () => {
      const config = { ...BASE_CONFIG, gravity: 0.5, flapStrength: -8 };
      const state = createFlapFortuneState(10, config);
      const startY = state.playerY;
      tickFlapFortune(state, true, config);
      expect(state.playerY).toBeLessThan(startY);
    });
  });

  describe('RTP simulation', () => {
    it('produces sane RTP over 10,000 rounds with immediate cash-out', () => {
      const rounds = 10000;
      let totalBet = 0;
      let totalPayout = 0;
      // Use gentle physics so players stay alive to test multiplier/RTP math
      const config = {
        ...BASE_CONFIG,
        gravity: 0.2,
        flapStrength: -3,
        pipeSpacing: 220,
        pipeGapHeight: 700, // near-full-screen gap — no pipe collisions
        scrollSpeed: 3,
        houseEdge: 0.03,
      };

      for (let i = 0; i < rounds; i++) {
        totalBet += 1;
        const state = createFlapFortuneState(1, config);

        // Flap only when falling (velocity > 0) to hover near center; run 200 ticks
        for (let tick = 0; tick < 200; tick++) {
          const shouldFlap = state.playerVelocityY > 1;
          tickFlapFortune(state, shouldFlap, config);
          if (!state.isAlive) break;
        }

        if (state.isAlive) {
          totalPayout += cashOutFlapFortune(state);
        }
      }

      const rtp = totalPayout / totalBet;
      // Most players should survive with gentle physics; RTP reflects house edge
      expect(rtp).toBeGreaterThan(0.3);
      expect(rtp).toBeLessThanOrEqual(3.0);
    });
  });
});
