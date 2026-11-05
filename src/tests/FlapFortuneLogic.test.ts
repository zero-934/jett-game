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

// ─── polish-003: round controller, geometry, replay and settlement ──────────
import {
  createFlapRound, stepFlapRound, canCashOutFlap, checkpointFlapRound, restoreFlapRound, FLAP_PLAYER_X, FLAP_PIPE_WIDTH,
} from '../games/FlapFortuneLogic';
import type { FlapRound } from '../games/FlapFortuneLogic';
import { FixedStepRunner } from '../shared/sim/FixedStepRunner';
import { hashState } from '../shared/sim/Replay';

const SCENE_CFG = { worldWidth: 390, worldHeight: 844, gravity: 0.45, flapStrength: -7.5, pipeSpacing: 230, pipeGapHeight: 158, scrollSpeed: 3, houseEdge: 0.03, combustionChancePerTick: 0.0003 };

/** Deterministic tick-boundary autopilot: flap when below the next gap centre and not rising. */
function autopilotFlap(round: FlapRound): boolean {
  const st = round.state;
  const next = st.pipes.find((p) => p.x + FLAP_PIPE_WIDTH > FLAP_PLAYER_X - 14) ?? st.pipes[0];
  const target = next ? next.topHeight + 79 : 422;
  return st.playerY > target + 6 && st.playerVelocityY > -1;
}

describe('Flap round geometry (source-accurate, unchanged)', () => {
  test('first spawn at tick 111 (x 157/450), tick 152 at 34/327; measured pitch 293 then 291', () => {
    // NOTE: docs/polish-003 states a later pitch of 294. The unchanged source produces 291:
    // pipes move before the spawn check, so a new pipe appears at x 450 when the previous one
    // reaches 159 (450 - 3 * 97). Geometry is preserved as-is; the doc figure is flagged.
    const round = createFlapRound('geometry', 10, { ...SCENE_CFG, combustionFloorPerTick: 0, combustionChancePerTick: 0 });
    const spawns: { tick: number; pitch: number }[] = [];
    for (let t = 1; t <= 400; t++) {
      round.state.playerY = 422; round.state.playerVelocityY = 0;
      round.state.pipes.forEach((p) => { p.topHeight = 343; p.bottomHeight = 844 - 343 - 158; });
      const lastBefore = round.state.pipes[round.state.pipes.length - 1];
      const lastBeforeX = lastBefore ? lastBefore.x : NaN;
      stepFlapRound(round, []);
      const pipes = round.state.pipes;
      const last = pipes[pipes.length - 1];
      if (last.x === 450 && lastBeforeX !== 453) spawns.push({ tick: t, pitch: 450 - pipes[pipes.length - 2].x });
      if (t === 152) expect(pipes.map((p) => p.x)).toEqual([34, 327]);
    }
    expect(spawns.slice(0, 3)).toEqual([{ tick: 111, pitch: 293 }, { tick: 208, pitch: 291 }, { tick: 305, pitch: 291 }]);
    expect(round.state.pipes.every((p) => Math.abs(844 - p.topHeight - p.bottomHeight - 158) < 1e-9)).toBe(true);
  });
});

describe('Flap round replay and timing', () => {
  const schedules: Record<string, (i: number) => number> = {
    hz30: () => 1000 / 30, hz60: () => 1000 / 60, hz120: () => 1000 / 120, hz144: () => 1000 / 144, jitter: (i) => 4 + ((i * 7919) % 29),
  };

  function record(): { log: Map<number, string[]>; hash: string; ticks: number; settlement: unknown } {
    const round = createFlapRound('replay-seed-1', 10, SCENE_CFG);
    const log = new Map<number, string[]>();
    for (let t = 0; t < 5000 && !round.settlement; t++) {
      const acts = autopilotFlap(round) ? ['flap'] : [];
      if (t === 700 && canCashOutFlap(round)) acts.push('cashOut');
      if (acts.length) log.set(t, acts);
      stepFlapRound(round, acts.map((type) => ({ type })));
    }
    return { log, hash: hashState(round.state), ticks: round.tick, settlement: round.settlement };
  }

  test.each(Object.keys(schedules))('same tick-indexed input log ⇒ identical state, RNG and settlement at %s', (name) => {
    const ref = record();
    const round = createFlapRound('replay-seed-1', 10, SCENE_CFG);
    const runner = new FixedStepRunner((t, acts) => stepFlapRound(round, [...acts, ...(ref.log.get(t) ?? []).map((type) => ({ type }))]));
    runner.begin();
    for (let i = 0; i < 100000 && runner.phase === 'playing'; i++) runner.advance(schedules[name](i));
    expect(hashState(round.state)).toBe(ref.hash);
    expect(round.settlement).toEqual(ref.settlement);
    expect(round.rng.getState()).toEqual(createReplayRng(ref));
  });

  function createReplayRng(ref: { log: Map<number, string[]> }) {
    const r = createFlapRound('replay-seed-1', 10, SCENE_CFG);
    for (let t = 0; t < 5000 && !r.settlement; t++) stepFlapRound(r, (ref.log.get(t) ?? []).map((type) => ({ type })));
    return r.rng.getState();
  }

  test('checkpoint mid-round restores and continues identically', () => {
    const a = createFlapRound('ckpt', 10, SCENE_CFG);
    for (let t = 0; t < 300 && !a.settlement; t++) stepFlapRound(a, autopilotFlap(a) ? [{ type: 'flap' }] : []);
    const b = restoreFlapRound(JSON.parse(JSON.stringify(checkpointFlapRound(a))), SCENE_CFG);
    for (let t = 0; t < 600 && !a.settlement; t++) {
      const acts = autopilotFlap(a) ? [{ type: 'flap' }] : [];
      stepFlapRound(a, acts); stepFlapRound(b, acts);
    }
    expect(hashState(b.state)).toBe(hashState(a.state));
    expect(b.settlement).toEqual(a.settlement);
    expect(() => restoreFlapRound({ ...checkpointFlapRound(a), simVersion: 1 }, SCENE_CFG)).toThrow(/simVersion/);
  });

  test('quick tap between ticks applies exactly one flap', () => {
    const round = createFlapRound('tap', 10, SCENE_CFG);
    const runner = new FixedStepRunner((_t, acts) => stepFlapRound(round, acts));
    runner.begin();
    runner.advance(8);
    runner.queue('flap'); // pointerdown, then pointerup before the tick: nothing to clear
    runner.advance(8);
    expect(round.state.playerVelocityY).toBeCloseTo(-7.05, 9);
    runner.queue('flap'); runner.queue('flap'); // two edges in one tick still give one impulse
    runner.advance(16);
    expect(round.state.playerVelocityY).toBeCloseTo(-7.05, 9);
  });
});

describe('Flap settlement (exactly once, ordered)', () => {
  function roundAfterFirstGate(): FlapRound {
    const r = createFlapRound('settle', 10, { ...SCENE_CFG, combustionFloorPerTick: 0, combustionChancePerTick: 0 });
    r.state.pipes = []; r.state.pipesCleared = 1; r.state.multiplier = 1.0573;
    return r;
  }

  test('cash-out before the first gate is rejected; returns stay on the dive rule', () => {
    const r = createFlapRound('early', 10, SCENE_CFG);
    expect(canCashOutFlap(r)).toBe(false);
    stepFlapRound(r, [{ type: 'cashOut' }]);
    expect(r.settlement).toBeNull();
  });

  test('same-tick cash-out and collision: cash-out validated at tick start wins (D-6 default)', () => {
    const r = roundAfterFirstGate();
    r.state.playerY = 300; r.state.playerVelocityY = 0;
    r.state.pipes = [{ x: 80 + 14 + 2, topHeight: 400, bottomHeight: 844 - 400 - 158, cleared: false }]; // next tick overlaps the top pipe
    const control = JSON.parse(JSON.stringify(r.state));
    stepFlapRound(r, [{ type: 'cashOut' }]);
    expect(r.settlement).toMatchObject({ reason: 'cashout', payout: 10.57, returnHundredths: 1057, tick: 0 });
    // Without the cash-out the same tick is a crash:
    const c = roundAfterFirstGate(); c.state = control;
    stepFlapRound(c, []);
    expect(c.settlement?.reason).toBe('crash');
  });

  test('dead at tick start rejects cash-out; repeated requests settle once', () => {
    const r = roundAfterFirstGate();
    stepFlapRound(r, [{ type: 'cashOut' }, { type: 'cashOut' }]);
    const first = r.settlement;
    stepFlapRound(r, [{ type: 'cashOut' }]);
    expect(r.settlement).toBe(first);
    const d = roundAfterFirstGate(); d.state.isAlive = false;
    stepFlapRound(d, [{ type: 'cashOut' }]);
    expect(d.settlement).toMatchObject({ reason: 'crash', payout: 0 }); // never a cash-out
  });

  test('dive exit preserved: floor after first gate pays, before first gate loses', () => {
    const r = roundAfterFirstGate(); r.state.playerY = 830; r.state.playerVelocityY = 6;
    stepFlapRound(r, []);
    expect(r.settlement).toMatchObject({ reason: 'dive', payout: 10.57 });
    const f = createFlapRound('floor', 10, { ...SCENE_CFG, combustionFloorPerTick: 0, combustionChancePerTick: 0 });
    f.state.pipes = []; f.state.playerY = 830; f.state.playerVelocityY = 6;
    stepFlapRound(f, []);
    expect(f.settlement).toMatchObject({ reason: 'floor', payout: 0 });
  });

  test('a configured combustion floor of 0 is honoured; the default floor is unchanged (0.0005)', () => {
    const off = createFlapRound('nocombust', 10, { ...SCENE_CFG, combustionFloorPerTick: 0, combustionChancePerTick: 0 });
    for (let t = 0; t < 2000 && !off.settlement; t++) { off.state.pipes = []; off.state.playerY = 422; off.state.playerVelocityY = 0; stepFlapRound(off, []); }
    expect(off.settlement).toBeNull();
    const def = createFlapFortuneState(10, { ...BASE_CONFIG, rng: () => 0.0004 }); def.pipes = [];
    tickFlapFortune(def, false, { ...BASE_CONFIG, rng: () => 0.0004 });
    expect(def.combusted).toBe(true);
  });
});
