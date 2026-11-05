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

// ─── polish-003: swept collision, determinism, round controller ─────────────
import {
  createJettRound, stepJettRound, canCashOutJett, checkpointJettRound, restoreJettRound, checkSweptAsteroidCollision,
  JETT_PLAYER_HIT_FRACTION, JETT_ASTEROID_HIT_FRACTION, JETT_COLLISION_EPSILON,
} from '../games/JettLogic';
import type { JettRound, JettAsteroid } from '../games/JettLogic';
import { FixedStepRunner } from '../shared/sim/FixedStepRunner';
import { hashState } from '../shared/sim/Replay';

const JETT_SCENE = { worldWidth: 390, screenHeight: 844, houseEdge: 0.03, combustionChancePerTick: 0.0008 };
const rock = (x: number, worldY: number, radius = 30): JettAsteroid => ({ id: 1, x, worldY, radius, driftX: 0, rotationAngle: 0, rotationSpeed: 0 });

describe('Jett swept collision (D-4)', () => {
  test('a one-tick swipe through an asteroid is a hit (no tunnelling)', () => {
    const st = createJettState(10, { ...JETT_SCENE, rng: () => 0.99 });
    st.playerX = 30; st.coins = [];
    st.asteroids = [{ ...rock(195, 1.2, 40), id: 99 }];
    tickJett(st, 360, { ...JETT_SCENE, rng: () => 0.99 });
    expect(st.isAlive).toBe(false);
    expect(st.combusted).toBe(false);
  });

  test('exact tangency is a hit; epsilon beyond is not; both sides tested', () => {
    const st = createJettState(10, JETT_SCENE);
    st.playerX = 100; st.playerWorldY = 0;
    const reach = st.playerRadius * JETT_PLAYER_HIT_FRACTION + 30 * JETT_ASTEROID_HIT_FRACTION;
    const at = (gap: number) => { st.asteroids = [rock(100 + reach + gap, 0)]; return checkSweptAsteroidCollision(st, 100, 0, new Map()); };
    expect(at(0)).toBe(true);                         // touching
    expect(at(-1e-3)).toBe(true);                     // overlapping
    expect(at(JETT_COLLISION_EPSILON * 0.5)).toBe(true);  // within the epsilon policy
    expect(at(JETT_COLLISION_EPSILON * 2)).toBe(false);   // just outside
    expect(at(1e-3)).toBe(false);
  });

  test('asteroid drift is included (relative motion) and new spawns are static', () => {
    const st = createJettState(10, JETT_SCENE);
    st.playerX = 100; st.playerWorldY = 0;
    st.asteroids = [rock(160, 0, 20)];
    // Asteroid moved from 90 to 160 this tick, passing through the player.
    expect(checkSweptAsteroidCollision(st, 100, 0, new Map([[1, 90]]))).toBe(true);
    expect(checkSweptAsteroidCollision(st, 100, 0, new Map())).toBe(false);
  });
});

describe('Jett determinism and replay', () => {
  const steerAt = (t: number) => 195 + Math.round(120 * Math.sin(t / 37));

  function record(seed: string) {
    const r = createJettRound(seed, 10, JETT_SCENE);
    const log = new Map<number, { type: string; value?: number }[]>();
    for (let t = 0; t < 4000 && !r.settlement; t++) {
      const acts: { type: string; value?: number }[] = [{ type: 'steer', value: steerAt(t) }];
      if (t === 900) acts.push({ type: 'cashOut' });
      log.set(t, acts);
      stepJettRound(r, acts);
    }
    return { log, r };
  }

  test('coins are placed by the seeded RNG: same seed ⇒ same coins; Math.random is never called', () => {
    const spy = jest.spyOn(Math, 'random');
    const a = record('coins-seed').r; const b = record('coins-seed').r;
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
    expect(a.state.coins.map((c) => c.x)).toEqual(b.state.coins.map((c) => c.x));
    expect(hashState(a.state)).toBe(hashState(b.state));
    expect(record('other-seed').r.seed).not.toBe(a.seed);
  });

  test.each([['hz30', 1000 / 30], ['hz60', 1000 / 60], ['hz120', 1000 / 120], ['hz144', 1000 / 144]])('same tick log ⇒ identical final state and settlement at %s', (_n, frame) => {
    const ref = record('sched');
    const r = createJettRound('sched', 10, JETT_SCENE);
    const runner = new FixedStepRunner((t, acts) => stepJettRound(r, [...acts, ...(ref.log.get(t) ?? [])]));
    runner.begin();
    for (let i = 0; i < 100000 && runner.phase === 'playing'; i++) runner.advance(frame);
    expect(hashState(r.state)).toBe(hashState(ref.r.state));
    expect(r.settlement).toEqual(ref.r.settlement);
    expect(r.rng.getState()).toEqual(ref.r.rng.getState());
  });

  test('checkpoint restore continues identically; state is JSON-safe', () => {
    const a = createJettRound('ck', 10, JETT_SCENE);
    for (let t = 0; t < 200 && !a.settlement; t++) stepJettRound(a, [{ type: 'steer', value: steerAt(t) }]);
    expect(Object.values(a.state).some((v) => typeof v === 'function')).toBe(false);
    const b = restoreJettRound(JSON.parse(JSON.stringify(checkpointJettRound(a))), JETT_SCENE);
    for (let t = 200; t < 800 && !a.settlement; t++) { const acts = [{ type: 'steer', value: steerAt(t) }]; stepJettRound(a, acts); stepJettRound(b, acts); }
    expect(hashState(b.state)).toBe(hashState(a.state));
  });
});

describe('Jett settlement', () => {
  function safeRound(): JettRound {
    const r = createJettRound('safe', 10, { ...JETT_SCENE, combustionChancePerTick: 0, combustionFloorPerTick: 0 });
    return r;
  }

  test('sub-1× early cash-out is reported honestly as a net loss (D-1: math preserved)', () => {
    const r = safeRound();
    r.state.asteroids = [];
    stepJettRound(r, []);
    stepJettRound(r, [{ type: 'cashOut' }]);
    expect(r.settlement).toMatchObject({ reason: 'cashout', multiplier: 0.9711, payout: 9.71, returnHundredths: 971 }); // pre-tick multiplier
    expect(r.settlement!.returnHundredths - 1000).toBeLessThan(0);
  });

  test('same-tick cash-out and collision: cash-out at tick start wins; without it the tick crashes', () => {
    const r = safeRound();
    r.state.asteroids = [{ ...rock(r.state.playerX, r.state.altitude + 25, 20), id: 500 }];
    const clone = JSON.parse(JSON.stringify(r.state));
    stepJettRound(r, [{ type: 'cashOut' }]);
    expect(r.settlement?.reason).toBe('cashout');
    const c = safeRound(); c.state = clone;
    stepJettRound(c, []);
    expect(c.settlement?.reason).toBe('crash');
    expect(c.settlement?.payout).toBe(0);
  });

  test('repeated cash-out settles once; dead rounds reject cash-out', () => {
    const r = safeRound(); r.state.asteroids = [];
    stepJettRound(r, [{ type: 'cashOut' }, { type: 'cashOut' }]);
    const s = r.settlement;
    stepJettRound(r, [{ type: 'cashOut' }]);
    expect(r.settlement).toBe(s);
    const d = safeRound(); d.state.isAlive = false;
    expect(canCashOutJett(d)).toBe(false);
  });

  test('golden fixture: altitude 400 + one granted coin ⇒ 1.4502× ⇒ 14.50 on a 10 stake', () => {
    const m = computeMultiplier(400, 0.03) + 0.03;
    expect(m).toBeCloseTo(1.4502, 4);
    expect(Math.round(m * 10 * 100) / 100).toBe(14.5);
  });

  test('combustion floor 0 is honoured; default floor 0.0008 unchanged', () => {
    let combusted = 0; let ticks = 0;
    for (let round = 0; round < 40 && ticks < 20000; round++) {
      const r = safeRound();
      for (let t = 0; t < 2000 && !r.settlement; t++) { stepJettRound(r, [{ type: 'steer', value: 20 + ((t * 7) % 350) }]); ticks++; }
      if (r.settlement?.reason === 'combust') combusted++;
    }
    expect(ticks).toBeGreaterThan(1000);
    expect(combusted).toBe(0); // asteroid crashes may occur; combustion never does
    const st = createJettState(10, { ...JETT_SCENE, rng: () => 0.0007 }); st.asteroids = [];
    st.rng = () => 0.0007;
    tickJett(st, 195, { ...JETT_SCENE, combustionChancePerTick: 0 });
    expect(st.combusted).toBe(true);
  });
});
