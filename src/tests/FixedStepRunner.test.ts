/**
 * @file FixedStepRunner.test.ts
 * @purpose Timing, input and settlement policy tests for the shared fixed-step runner, plus the
 *          replay format and demo ledger.
 * @author Agent 934
 * @date 2026-11-05
 * @license Proprietary – available for licensing
 */
import { FixedStepRunner, replayActions } from '../shared/sim/FixedStepRunner';
import type { TickAction } from '../shared/sim/FixedStepRunner';
import { canonicalJSON, hashState, assertReplayCompatible, REPLAY_SCHEMA_VERSION } from '../shared/sim/Replay';
import { DemoLedger, toHundredths, formatCredits } from '../shared/sim/DemoLedger';

const counterSim = () => {
  const seen: TickAction[] = [];
  let ticks = 0;
  const runner = new FixedStepRunner((_t, actions) => { ticks++; seen.push(...actions); return { settled: false }; });
  return { runner, seen, ticks: () => ticks };
};

function runFor(runner: FixedStepRunner, wallMs: number, frameMs: (i: number) => number): number {
  let elapsed = 0; let i = 0;
  while (elapsed < wallMs) { const dt = frameMs(i++); elapsed += dt; runner.advance(dt); }
  return elapsed;
}

describe('FixedStepRunner timing policy', () => {
  test.each([
    ['30 Hz', 1000 / 30], ['60 Hz', 1000 / 60], ['120 Hz', 1000 / 120], ['144 Hz', 1000 / 144],
  ])('foreground %s keeps real-time pace: ticks == floor(wall / 16)', (_label, frame) => {
    const { runner } = counterSim();
    runner.begin();
    const wall = runFor(runner, 5000, () => frame);
    expect(runner.tick).toBe(Math.floor(wall / 16 + 1e-9));
    expect(runner.paused).toBeNull();
  });

  test('irregular frames keep pace (jitter 4–32 ms)', () => {
    const { runner } = counterSim();
    runner.begin();
    const wall = runFor(runner, 5000, (i) => 4 + ((i * 7919) % 29));
    expect(runner.tick).toBe(Math.floor(wall / 16 + 1e-9));
  });

  test('500 ms foreground hitch: debt retained and worked off at ≤8 ticks/frame, no time lost', () => {
    const { runner } = counterSim();
    runner.begin();
    runFor(runner, 1000, () => 1000 / 60);
    const before = runner.tick;
    expect(runner.advance(500)).toBe(8);          // capped this frame
    expect(runner.debt).toBeGreaterThan(300);     // debt kept, not dropped
    let frames = 0;
    while (runner.debt >= 16) { runner.advance(0); frames++; }
    expect(frames).toBe(Math.ceil((31 - 8) / 8)); // 3 more frames of catch-up
    expect(runner.tick - before).toBe(31);        // floor(500/16) = 31 ticks: wall time preserved
    expect(runner.stats.droppedMs).toBe(0);
    expect(runner.stats.maxTicksInFrame).toBe(8);
  });

  test('hitch beyond maxDebtMs (1000 ms) pauses at a recorded boundary and discards debt', () => {
    const { runner } = counterSim();
    runner.begin();
    runFor(runner, 320, () => 16);
    const tickAtHitch = runner.tick;
    expect(runner.advance(1500)).toBe(0);
    expect(runner.paused).toBe('hitch');
    expect(runner.pauseBoundaries[0]).toMatchObject({ tick: tickAtHitch, reason: 'hitch', droppedDebtMs: 1500 });
    expect(runner.advance(16)).toBe(0);           // still paused
    runner.resume();
    expect(runner.debt).toBe(0);
    expect(runner.advance(16)).toBe(1);
    expect(runner.pauseBoundaries[0].resumedAtTick).toBe(tickAtHitch);
  });

  test('visibility pause: no background catch-up, stale input cleared, deterministic resume tick', () => {
    const { runner, seen } = counterSim();
    runner.begin();
    runFor(runner, 160, () => 16);
    runner.queue('flap');                // pressed just before the tab is hidden
    runner.pause('hidden');
    expect(runner.queue('flap')).toBeNull(); // rejected while hidden
    runner.advance(3_600_000);              // an hour in the background
    expect(runner.tick).toBe(10);
    runner.resume();
    runner.advance(16);
    expect(runner.tick).toBe(11);
    expect(seen).toHaveLength(0);           // the pre-hide press never applies after resume
  });
});

describe('FixedStepRunner input and settlement', () => {
  test('down+up between ticks keeps one edge action on the next tick', () => {
    const { runner, seen } = counterSim();
    runner.begin();
    runner.advance(10);                     // no tick yet
    runner.queue('flap');                   // pointerdown; pointerup does nothing
    runner.advance(10);                     // 20 ms debt → tick 0
    expect(seen).toEqual([{ tick: 0, seq: 0, type: 'flap' }]);
  });

  test('actions get increasing sequence numbers and the next unsimulated tick', () => {
    const { runner } = counterSim();
    runner.begin();
    runner.advance(48);                     // ticks 0..2
    const a = runner.queue('steer', 120);
    const b = runner.queue('cashOut');
    expect(a).toMatchObject({ tick: 3, seq: 0 });
    expect(b).toMatchObject({ tick: 3, seq: 1 });
  });

  test('input before begin() and after settlement is rejected', () => {
    let seen = 0;
    const runner = new FixedStepRunner((_t, a) => { seen += a.length; return { settled: a.some((x) => x.type === 'cashOut') }; });
    expect(runner.queue('flap')).toBeNull();
    runner.begin();
    runner.queue('cashOut');
    runner.advance(16);
    expect(runner.phase).toBe('settling');
    expect(runner.queue('flap')).toBeNull();
    expect(runner.advance(160)).toBe(0);
    expect(seen).toBe(1);
  });

  test('markSettled is exactly-once', () => {
    const { runner } = counterSim();
    runner.begin();
    expect(runner.markSettled()).toBe(true);
    expect(runner.markSettled()).toBe(false);
    runner.finishSettlement();
    expect(runner.phase).toBe('settled');
    expect(runner.settlements).toBe(1);
  });

  test('replayActions reproduces the per-tick action stream', () => {
    const live: string[] = [];
    const runner = new FixedStepRunner((t, a) => { live.push(`${t}:${a.map((x) => x.type).join('+')}`); return { settled: t === 40 }; });
    runner.begin();
    for (let i = 0; i < 60 && runner.phase === 'playing'; i++) { if (i % 7 === 0) runner.queue('flap'); if (i === 20) runner.queue('steer', 3); runner.advance(1000 / 60); }
    const replayed: string[] = [];
    replayActions((t, a) => { replayed.push(`${t}:${a.map((x) => x.type).join('+')}`); return { settled: t === 40 }; }, runner.actionLog, 1000);
    expect(replayed).toEqual(live);
  });
});

describe('Replay format', () => {
  test('canonical JSON sorts keys and drops functions/undefined', () => {
    expect(canonicalJSON({ b: 1, a: { d: [1, undefined], c: 'x' }, f: () => 1, u: undefined })).toBe('{"a":{"c":"x","d":[1,null]},"b":1}');
  });

  test('hash is stable and sensitive', () => {
    expect(hashState({ a: 1, b: 2 })).toBe(hashState({ b: 2, a: 1 }));
    expect(hashState({ a: 1 })).not.toBe(hashState({ a: 1.0000001 }));
    expect(hashState({})).toMatch(/^[0-9a-f]{16}$/);
  });

  test('version mismatch is rejected', () => {
    const header = { schema: REPLAY_SCHEMA_VERSION, game: 'flap' as const, simVersion: 2, rngAlgorithm: 'xoroshiro128plus-v2' as const, seed: 's', tickMs: 16, config: {} };
    expect(() => assertReplayCompatible(header, { game: 'flap', simVersion: 2, rngAlgorithm: 'xoroshiro128plus-v2', tickMs: 16 })).not.toThrow();
    expect(() => assertReplayCompatible(header, { game: 'flap', simVersion: 3, rngAlgorithm: 'xoroshiro128plus-v2', tickMs: 16 })).toThrow(/simVersion/);
    expect(() => assertReplayCompatible({ ...header, schema: 99 }, { game: 'flap', simVersion: 2, rngAlgorithm: 'xoroshiro128plus-v2', tickMs: 16 })).toThrow(/schema/);
    expect(() => assertReplayCompatible(header, { game: 'flap', simVersion: 2, rngAlgorithm: 'legacy-v1', tickMs: 16 })).toThrow(/rngAlgorithm/);
  });
});

describe('DemoLedger', () => {
  test('one debit on start, one credit on settle; handoff fixtures', () => {
    const l = new DemoLedger();
    expect(formatCredits(l.balanceHundredths)).toBe('1,000.00');
    expect(l.start('r1', 1000)).toBe(true);
    expect(formatCredits(l.balanceHundredths)).toBe('990.00');
    expect(l.start('r1', 1000)).toBe(false);                    // no double debit
    expect(l.settle('r1', toHundredths(14.5), 'cashout')?.netHundredths).toBe(450);
    expect(formatCredits(l.balanceHundredths)).toBe('1,004.50');
    expect(l.settle('r1', 99999, 'cashout')?.returnHundredths).toBe(1450); // idempotent
    expect(formatCredits(l.balanceHundredths)).toBe('1,004.50');
  });

  test('Flap 10.57, Shatter 32.74, loss fixtures; unknown round rejected', () => {
    const cases: [number, string][] = [[10.57, '1,000.57'], [32.74, '1,022.74'], [0, '990.00']];
    for (const [ret, bal] of cases) {
      const l = new DemoLedger();
      l.start('r', 1000);
      l.settle('r', toHundredths(ret), 'x');
      expect(formatCredits(l.balanceHundredths)).toBe(bal);
    }
    expect(new DemoLedger().settle('nope', 100, 'x')).toBeNull();
    expect(formatCredits(-450)).toBe('-4.50');
  });
});
