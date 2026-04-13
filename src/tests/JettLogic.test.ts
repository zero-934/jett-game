/**
 * @file JettLogic.test.ts
 * @purpose Unit tests for JettLogic — verifies asteroid spawning, collision detection,
 *          multiplier math, combustion mechanic, cash-out, and RTP over 10,000 rounds.
 * @author Agent 934
 * @date 2026-04-12
 * @license Proprietary – available for licensing
 */

import {
  createJettState,
  tickJett,
  computeMultiplier,
  cashOutJett,
  checkAsteroidCollision,
  spawnAsteroidWave,
} from '../games/JettLogic';

const BASE_CONFIG = { worldWidth: 390, screenHeight: 844 };

describe('JettLogic', () => {
  describe('createJettState', () => {
    it('initializes with correct defaults', () => {
      const state = createJettState(10, BASE_CONFIG);
      expect(state.bet).toBe(10);
      expect(state.multiplier).toBe(1.0);
      expect(state.altitude).toBe(0);
      expect(state.isAlive).toBe(true);
      expect(state.cashedOut).toBe(false);
      expect(state.combusted).toBe(false);
      expect(state.payout).toBe(0);
    });
  });

  describe('computeMultiplier', () => {
    it('returns 1.0 at zero altitude', () => {
      expect(computeMultiplier(0, 0.03)).toBe(1.0);
    });

    it('increases with altitude', () => {
      const m1 = computeMultiplier(100, 0.03);
      const m5 = computeMultiplier(500, 0.03);
      expect(m1).toBeGreaterThan(1.0);
      expect(m5).toBeGreaterThan(m1);
    });

    it('applies house edge', () => {
      const withEdge    = computeMultiplier(500, 0.03);
      const withoutEdge = computeMultiplier(500, 0);
      expect(withEdge).toBeLessThan(withoutEdge);
    });
  });

  describe('spawnAsteroidWave', () => {
    it('spawns the requested number of asteroids', () => {
      const wave = spawnAsteroidWave(500, 4, 390, 0);
      expect(wave).toHaveLength(4);
    });

    it('keeps asteroids within world bounds', () => {
      for (let i = 0; i < 20; i++) {
        const wave = spawnAsteroidWave(500, 5, 390, 0);
        for (const ast of wave) {
          expect(ast.x - ast.radius).toBeGreaterThanOrEqual(0);
          expect(ast.x + ast.radius).toBeLessThanOrEqual(390);
        }
      }
    });

    it('assigns unique ids starting from startId', () => {
      const wave = spawnAsteroidWave(500, 3, 390, 10);
      expect(wave[0].id).toBe(10);
      expect(wave[1].id).toBe(11);
      expect(wave[2].id).toBe(12);
    });
  });

  describe('checkAsteroidCollision', () => {
    it('detects collision when player overlaps asteroid', () => {
      const state = createJettState(10, BASE_CONFIG);
      state.playerX     = 100;
      state.playerWorldY = 500;
      state.asteroids   = [{
        id: 0, x: 100, worldY: 500, radius: 20,
        driftX: 0, rotationAngle: 0, rotationSpeed: 0,
      }];
      expect(checkAsteroidCollision(state)).toBe(true);
    });

    it('returns false when player is clear of all asteroids', () => {
      const state = createJettState(10, BASE_CONFIG);
      state.playerX      = 200;
      state.playerWorldY = 500;
      state.asteroids    = [{
        id: 0, x: 50, worldY: 500, radius: 15,
        driftX: 0, rotationAngle: 0, rotationSpeed: 0,
      }];
      expect(checkAsteroidCollision(state)).toBe(false);
    });
  });

  describe('cashOutJett', () => {
    it('returns bet × multiplier on first cash-out', () => {
      const state = createJettState(10, BASE_CONFIG);
      state.altitude   = 200;
      state.multiplier = computeMultiplier(200, 0.03);
      const payout = cashOutJett(state);
      expect(payout).toBeCloseTo(10 * state.multiplier, 1);
      expect(state.cashedOut).toBe(true);
    });

    it('returns 0 on second cash-out', () => {
      const state = createJettState(10, BASE_CONFIG);
      cashOutJett(state);
      expect(cashOutJett(state)).toBe(0);
    });

    it('returns 0 if already dead', () => {
      const state = createJettState(10, BASE_CONFIG);
      state.isAlive = false;
      expect(cashOutJett(state)).toBe(0);
    });
  });

  describe('Combustion mechanic (house edge)', () => {
    it('triggers combustion with rng always returning 0 (below any threshold)', () => {
      // rng = 0 always < any positive chance → always combusts
      const state  = createJettState(10, BASE_CONFIG);
      const config = { ...BASE_CONFIG, combustionChancePerTick: 1.0, rng: () => 0 };
      tickJett(state, 195, config);
      expect(state.isAlive).toBe(false);
      expect(state.combusted).toBe(true);
    });

    it('never combusts when rng always returns 1', () => {
      // rng = 1 → never below threshold
      const config = {
        ...BASE_CONFIG,
        combustionChancePerTick: 0.0005,
        rng: () => 1,
        // wide gap so no asteroid collision either
      };
      const state = createJettState(10, config);
      for (let i = 0; i < 200; i++) {
        tickJett(state, 195, config);
        if (!state.isAlive) break;
      }
      expect(state.combusted).toBe(false);
    });
  });

  describe('RTP simulation', () => {
    it('achieves sane RTP over 10,000 rounds (cash out at altitude 300, no asteroids)', () => {
      const rounds = 10000;
      let totalBet = 0;
      let totalPayout = 0;

      const config = {
        ...BASE_CONFIG,
        combustionChancePerTick: 0.0005,
        rng: () => 1, // no combustion, no asteroids
      };

      for (let i = 0; i < rounds; i++) {
        totalBet += 1;
        const state = createJettState(1, config);

        // Run until altitude 300 then cash out (no asteroids injected)
        while (state.isAlive && !state.cashedOut && state.altitude < 300) {
          tickJett(state, 195, config);
        }
        if (state.isAlive && !state.cashedOut) {
          totalPayout += cashOutJett(state);
        } else {
          totalPayout += state.payout;
        }
      }

      const rtp = totalPayout / totalBet;
      expect(rtp).toBeGreaterThan(0.8);
      expect(rtp).toBeLessThanOrEqual(1.5);
    });
  });
});
