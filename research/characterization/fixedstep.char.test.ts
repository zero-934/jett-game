/**
 * @file fixedstep.char.test.ts
 * @purpose Demonstrates the PROPOSED FixedStepRunner against the UNMODIFIED Flap Fortune logic:
 *          identical outcomes across 30/60/120/144 Hz and jittered schedules, quick-tap retention,
 *          checkpoint/restore, idempotent settlement. Research only.
 * @author Agent 934 (research branch)
 * @date 2026-11-05
 * @license Proprietary – available for licensing
 */
import { FixedStepRunner } from '../patches/FixedStepRunner';
import type { TickAction } from '../patches/FixedStepRunner';
import { ProvablyFairRNG } from '../patches/ProvablyFairRNG.masked';
import { createFlapFortuneState, tickFlapFortune } from '../../src/games/FlapFortuneLogic';
import type { FlapFortuneConfig, FlapFortuneState } from '../../src/games/FlapFortuneLogic';

const BASE: FlapFortuneConfig = { worldWidth: 390, worldHeight: 844, gravity: 0.45, flapStrength: -7.5, pipeSpacing: 230, pipeGapHeight: 158, scrollSpeed: 3, houseEdge: 0.03, combustionChancePerTick: 0.0003 };

function makeSim(seed: string) {
  const rng = new ProvablyFairRNG(seed);
  const cfg: FlapFortuneConfig = { ...BASE, rng: () => rng.random() };
  const state = createFlapFortuneState(10, cfg);
  const step = (_tick: number, actions: readonly TickAction[]) => {
    tickFlapFortune(state, actions.some((a) => a.type === 'flap'), cfg);
    return !state.isAlive;
  };
  return { rng, cfg, state, step };
}

/** Scripted player: flap whenever below the gap centre of the nearest pipe (deterministic per tick). */
function autopilot(state: FlapFortuneState): boolean {
  const next = state.pipes.find((p) => p.x + 30 > 66) ?? state.pipes[0];
  const target = next ? next.topHeight + 79 : 422;
  return state.playerY > target + 10 && state.playerVelocityY > -1;
}

function runWithSchedule(frameMs: (i: number) => number, maxFrames = 4000) {
  const sim = makeSim('fixed-step-demo');
  const runner = new FixedStepRunner((t, a) => {
    const done = sim.step(t, a);
    if (!done && autopilot(sim.state)) runner.queue({ type: 'flap' });
    return done;
  });
  runner.begin();
  for (let i = 0; i < maxFrames && runner.phase === 'playing'; i++) runner.advance(frameMs(i));
  return { finalState: JSON.stringify(sim.state), ticks: runner.tick, log: runner.actionLog, stats: runner.stats };
}

describe('Proposed fixed-step runner with current Flap logic', () => {
  const schedules: Record<string, (i: number) => number> = {
    hz30: () => 1000 / 30, hz60: () => 1000 / 60, hz120: () => 1000 / 120, hz144: () => 1000 / 144,
    jitter: (i) => 4 + ((i * 7919) % 29), hitch: (i) => (i === 50 ? 120 : 1000 / 60),
  };

  test('same seed + same per-tick decisions => identical final state on every schedule', () => {
    const outcomes = Object.fromEntries(Object.entries(schedules).map(([k, f]) => [k, runWithSchedule(f)]));
    const ref = outcomes.hz60.finalState;
    for (const [k, o] of Object.entries(outcomes)) {
      expect({ k, same: o.finalState === ref }).toEqual({ k, same: true });
    }
    // eslint-disable-next-line no-console
    console.log(Object.entries(outcomes).map(([k, o]) => `${k}: ticks=${o.ticks} zeroTickFrames=${o.stats.framesWithZeroTicks} maxTicks/frame=${o.stats.maxTicksInFrame}`).join('\n'));
  });

  test('replay of the action log reproduces the state exactly', () => {
    const live = runWithSchedule(schedules.jitter);
    const sim = makeSim('fixed-step-demo');
    FixedStepRunner.replay(sim.step, live.log, live.ticks);
    expect(JSON.stringify(sim.state)).toBe(live.finalState);
  });

  test('quick tap (press+release between ticks) is retained as a flap action', () => {
    const sim = makeSim('tap');
    const runner = new FixedStepRunner(sim.step);
    runner.begin();
    runner.queue({ type: 'flap' });  // pointerdown
    /* pointerup arrives here: nothing to clear — actions are edge events, not a level flag */
    runner.advance(16);
    expect(sim.state.playerVelocityY).toBeCloseTo(-7.05, 6);
  });

  test('checkpoint (state + RNG snapshot + tick) restores and continues identically', () => {
    const a = makeSim('ckpt');
    for (let t = 0; t < 200 && a.state.isAlive; t++) a.step(t, t % 15 === 0 ? [{ tick: t, type: 'flap' }] : []);
    const checkpoint = JSON.stringify({ version: 1, tick: 200, state: a.state, rng: a.rng.getState() });
    const parsed = JSON.parse(checkpoint);
    const b = makeSim('unrelated');
    Object.assign(b.state, parsed.state);
    b.rng.setState(parsed.rng);
    for (let t = 200; t < 500; t++) {
      const acts = t % 15 === 0 ? [{ tick: t, type: 'flap' }] : [];
      a.step(t, acts); b.step(t, acts);
    }
    expect(JSON.stringify(b.state)).toBe(JSON.stringify(a.state));
  });

  test('settle() is idempotent; queue() after settlement is ignored', () => {
    const r = new FixedStepRunner(() => false);
    r.begin();
    expect(r.settle()).toBe(true);
    expect(r.settle()).toBe(false);
    r.queue({ type: 'flap' });
    expect(r.advance(100)).toBe(0);
    expect(r.settlements).toBe(1);
  });

  test('queue() before begin() is ignored (ready phase input never reaches gameplay)', () => {
    let seen = 0;
    const r = new FixedStepRunner((_t, a) => { seen += a.length; return false; });
    r.queue({ type: 'flap' });
    r.begin(); r.advance(16);
    expect(seen).toBe(0);
  });
});
