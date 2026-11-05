/**
 * @file FixedStepRunner.ts
 * @purpose Pure-TS fixed-step simulation driver shared by Jett, Flap Fortune and Shatter Step.
 *          No Phaser imports. Reviewed from research/patches/FixedStepRunner.ts with these changes:
 *          - explicit time-debt policy instead of silently dropping time after the catch-up cap;
 *          - explicit pause/resume boundaries (visibility, settings, excessive hitch);
 *          - ready → playing → settling → settled phases, settlement callback exactly once;
 *          - sequence-numbered, tick-stamped action log for replay.
 *
 * Time policy (documented contract, see docs/polish-003/BUILD_CONTRACT.md §Replay):
 *  1. Simulation advances only in whole ticks of `stepMs` (default 16 ms = nominal 62.5 Hz,
 *     unchanged from production).
 *  2. Each frame adds its real elapsed time to a debt accumulator. At most `maxTicksPerFrame`
 *     ticks run per frame; remaining debt is KEPT and worked off on following frames, so an
 *     ordinary foreground hitch does not lose wall-clock time.
 *  3. If debt ever exceeds `maxDebtMs`, the runner pauses itself (reason 'hitch'), discards
 *     the debt and records a pause boundary at the current tick. Gameplay resumes only through
 *     `resume()`, which also discards debt. This bounds work and avoids a fast-forward the
 *     player cannot react to.
 *  4. `pause('hidden' | 'settings' | ...)` behaves the same way. Background time is never
 *     caught up.
 *  5. Inputs queued while paused or outside `playing` are rejected (not deferred).
 * @author Agent 934
 * @date 2026-11-05
 * @license Proprietary – available for licensing
 */

/** Round phase. */
export type RoundPhase = 'ready' | 'playing' | 'settling' | 'settled';

/** Why a pause boundary was recorded. */
export type PauseReason = 'hidden' | 'blur' | 'settings' | 'hitch' | 'manual';

/** A tick-stamped input action. `seq` is monotonically increasing per runner. */
export interface TickAction {
  tick: number;
  seq: number;
  type: string;
  value?: number;
}

/** A pause/resume boundary in tick time. */
export interface PauseBoundary {
  tick: number;
  reason: PauseReason;
  droppedDebtMs: number;
  resumedAtTick?: number;
}

/** Result of one simulated tick. */
export interface TickOutcome {
  /** True when the round reached a terminal state this tick. */
  settled: boolean;
}

/** Runner options. */
export interface FixedStepOptions {
  /** Milliseconds per tick. Default 16 (production pacing). */
  stepMs?: number;
  /** Maximum ticks per frame before deferring debt. Default 8. */
  maxTicksPerFrame?: number;
  /** Debt above which the runner pauses itself. Default 1000 ms. */
  maxDebtMs?: number;
}

/** Counters for tests and diagnostics. */
export interface FixedStepStats {
  ticks: number;
  frames: number;
  framesWithZeroTicks: number;
  maxTicksInFrame: number;
  /** Total debt discarded at pause boundaries. */
  droppedMs: number;
}

/** Interpolation never reaches the next tick's state. */
const MAX_ALPHA = 0.999;

/** Default tick length (ms). Preserves the existing 62.5 Hz simulation. */
export const DEFAULT_STEP_MS = 16;
/** Default per-frame catch-up limit. */
export const DEFAULT_MAX_TICKS_PER_FRAME = 8;
/** Default maximum retained debt before an automatic pause. */
export const DEFAULT_MAX_DEBT_MS = 1000;

/**
 * Fixed-step driver. The simulation callback is pure game logic; the runner never reads clocks.
 *
 * @example
 * const runner = new FixedStepRunner((tick, actions) => ({ settled: step(tick, actions) }));
 * runner.begin();
 * runner.queue('flap');
 * runner.advance(16.7);
 */
export class FixedStepRunner {
  readonly stepMs: number;
  readonly maxTicksPerFrame: number;
  readonly maxDebtMs: number;
  readonly stats: FixedStepStats = { ticks: 0, frames: 0, framesWithZeroTicks: 0, maxTicksInFrame: 0, droppedMs: 0 };

  private debtMs = 0;
  private tickIndex = 0;
  private seqCounter = 0;
  private phaseValue: RoundPhase = 'ready';
  private pausedReason: PauseReason | null = null;
  private pending: TickAction[] = [];
  private readonly log: TickAction[] = [];
  private readonly boundaries: PauseBoundary[] = [];
  private settleCalls = 0;
  private readonly simulate: (tick: number, actions: readonly TickAction[]) => TickOutcome;

  /**
   * @param simulate - Pure step: applies `actions` then advances one tick.
   * @param options - Timing options.
   */
  constructor(simulate: (tick: number, actions: readonly TickAction[]) => TickOutcome, options: FixedStepOptions = {}) {
    this.simulate = simulate;
    this.stepMs = options.stepMs ?? DEFAULT_STEP_MS;
    this.maxTicksPerFrame = options.maxTicksPerFrame ?? DEFAULT_MAX_TICKS_PER_FRAME;
    this.maxDebtMs = options.maxDebtMs ?? DEFAULT_MAX_DEBT_MS;
  }

  /** @returns Current phase. */
  get phase(): RoundPhase { return this.phaseValue; }
  /** @returns Index of the next tick to simulate. */
  get tick(): number { return this.tickIndex; }
  /** @returns Pause reason, or null while running. */
  get paused(): PauseReason | null { return this.pausedReason; }
  /** @returns Retained time debt in ms. */
  get debt(): number { return this.debtMs; }
  /** @returns Render interpolation fraction in [0, 1). Cosmetic only. */
  get alpha(): number { return Math.min(this.debtMs / this.stepMs, MAX_ALPHA); }
  /** @returns Copy of all accepted actions (replay log). */
  get actionLog(): readonly TickAction[] { return this.log.slice(); }
  /** @returns Copy of all pause boundaries. */
  get pauseBoundaries(): readonly PauseBoundary[] { return this.boundaries.map((b) => ({ ...b })); }
  /** @returns Number of times settlement actually happened (0 or 1). */
  get settlements(): number { return this.settleCalls; }

  /**
   * ready → playing. Idempotent; ignored after settlement.
   * @returns true if this call started the round.
   * @example
   * runner.begin();
   */
  begin(): boolean {
    if (this.phaseValue !== 'ready') return false;
    this.phaseValue = 'playing';
    this.debtMs = 0;
    return true;
  }

  /**
   * Queues an edge action for the next unsimulated tick.
   * @param type - Action type, e.g. 'flap', 'cashOut', 'steer'.
   * @param value - Optional canonical numeric payload (integers recommended).
   * @returns The accepted action, or null if rejected (not playing, paused or settled).
   * @example
   * runner.queue('flap');
   */
  queue(type: string, value?: number): TickAction | null {
    if (this.phaseValue !== 'playing' || this.pausedReason) return null;
    const action: TickAction = value === undefined ? { tick: this.tickIndex, seq: this.seqCounter++, type } : { tick: this.tickIndex, seq: this.seqCounter++, type, value };
    this.pending.push(action);
    return action;
  }

  /**
   * Pauses simulation and discards debt at a recorded boundary. Idempotent.
   * @param reason - Why the runner paused.
   * @returns void
   * @example
   * runner.pause('hidden');
   */
  pause(reason: PauseReason): void {
    if (this.pausedReason || this.phaseValue !== 'playing') return;
    this.pausedReason = reason;
    this.boundaries.push({ tick: this.tickIndex, reason, droppedDebtMs: this.debtMs });
    this.stats.droppedMs += this.debtMs;
    this.debtMs = 0;
    this.pending = []; // stale input from before the pause never applies afterwards
  }

  /**
   * Resumes from a pause. Debt starts at zero.
   * @returns true if the runner was paused.
   * @example
   * runner.resume();
   */
  resume(): boolean {
    if (!this.pausedReason) return false;
    this.pausedReason = null;
    this.debtMs = 0;
    const last = this.boundaries[this.boundaries.length - 1];
    if (last) last.resumedAtTick = this.tickIndex;
    return true;
  }

  /**
   * Marks the round settled exactly once (e.g. from a cash-out applied inside a tick, or a
   * logic terminal state). Further calls return false.
   * @returns true only for the first call.
   * @example
   * if (runner.markSettled()) ledger.settle(roundId, amount);
   */
  markSettled(): boolean {
    if (this.phaseValue === 'settling' || this.phaseValue === 'settled') return false;
    this.phaseValue = 'settling';
    this.settleCalls++;
    this.pending = [];
    return true;
  }

  /**
   * settling → settled once the result presentation is ready. Idempotent.
   * @returns void
   * @example
   * runner.finishSettlement();
   */
  finishSettlement(): void {
    if (this.phaseValue === 'settling') this.phaseValue = 'settled';
  }

  /**
   * Advances by one rendered frame of real elapsed time.
   * @param frameDeltaMs - Real (unsmoothed) elapsed ms since the previous frame.
   * @returns Number of ticks simulated this frame.
   * @example
   * runner.advance(game.loop.rawDelta);
   */
  advance(frameDeltaMs: number): number {
    this.stats.frames++;
    if (this.phaseValue !== 'playing' || this.pausedReason) { this.stats.framesWithZeroTicks++; return 0; }
    this.debtMs += Number.isFinite(frameDeltaMs) ? Math.max(0, frameDeltaMs) : 0;
    if (this.debtMs > this.maxDebtMs) {
      this.pause('hitch');
      this.stats.framesWithZeroTicks++;
      return 0;
    }
    let ran = 0;
    while (this.debtMs >= this.stepMs && ran < this.maxTicksPerFrame && this.phaseValue === 'playing') {
      ran += this.stepOnce();
      this.debtMs -= this.stepMs;
    }
    if (this.phaseValue !== 'playing') this.debtMs = 0;
    if (ran === 0) this.stats.framesWithZeroTicks++;
    this.stats.maxTicksInFrame = Math.max(this.stats.maxTicksInFrame, ran);
    return ran;
  }

  /**
   * Runs exactly one tick regardless of time (tests, replay, headless sims).
   * @returns 1 if a tick ran, else 0.
   * @example
   * runner.stepOnce();
   */
  stepOnce(): number {
    if (this.phaseValue !== 'playing' || this.pausedReason) return 0;
    const actions = this.pending.map((a) => ({ ...a, tick: this.tickIndex }));
    this.pending = [];
    this.log.push(...actions);
    const outcome = this.simulate(this.tickIndex, actions);
    this.tickIndex++;
    this.stats.ticks++;
    if (outcome.settled) this.markSettled();
    return 1;
  }
}

/**
 * Replays a recorded action log tick by tick without frame timing.
 *
 * @param simulate - Fresh simulation step with identical initial state.
 * @param log - Actions from {@link FixedStepRunner.actionLog}.
 * @param maxTicks - Upper bound on ticks to replay.
 * @returns Number of ticks simulated before settlement or the bound.
 * @example
 * replayActions(freshStep, runner.actionLog, runner.tick);
 */
export function replayActions(simulate: (tick: number, actions: readonly TickAction[]) => TickOutcome, log: readonly TickAction[], maxTicks: number): number {
  const sorted = log.slice().sort((a, b) => a.tick - b.tick || a.seq - b.seq);
  let i = 0;
  for (let t = 0; t < maxTicks; t++) {
    const actions: TickAction[] = [];
    while (i < sorted.length && sorted[i].tick === t) actions.push(sorted[i++]);
    if (simulate(t, actions).settled) return t + 1;
  }
  return maxTicks;
}
