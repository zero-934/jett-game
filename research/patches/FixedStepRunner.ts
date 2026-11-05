/**
 * @file FixedStepRunner.ts
 * @purpose PROPOSED (review-only) pure-TS fixed-step simulation driver. No Phaser imports.
 *          - integer tick index, fixed dt (default 16 ms to preserve current 62.5 Hz pacing)
 *          - accumulator with bounded catch-up (hitches drop time explicitly, counted)
 *          - tick-indexed input queue: actions are latched into the NEXT tick boundary, so a
 *            press+release between ticks is never lost
 *          - phases: ready -> playing -> settled; settle() is idempotent
 *          - render interpolation alpha exposed for cosmetic smoothing only
 * @author Agent 934 (research branch)
 * @date 2026-11-05
 * @license Proprietary – available for licensing
 */

export type Phase = 'ready' | 'playing' | 'settled';

/** A discrete input action recorded against the tick it applies to. */
export interface TickAction { tick: number; type: string; value?: number; }

export interface FixedStepOptions {
  /** Milliseconds per simulation tick. 16 preserves today's nominal 62.5 Hz. */
  stepMs?: number;
  /** Maximum ticks simulated per frame before excess time is dropped. */
  maxTicksPerFrame?: number;
}

export interface FixedStepStats { ticks: number; droppedMs: number; framesWithZeroTicks: number; maxTicksInFrame: number; }

/**
 * Drives a pure simulation callback at a fixed rate from arbitrary frame deltas.
 *
 * @example
 * const runner = new FixedStepRunner((tick, actions) => sim.step(tick, actions));
 * runner.begin();
 * runner.queue({ type: 'flap' });
 * runner.advance(16.7); // call once per rendered frame with real delta
 */
export class FixedStepRunner {
  private readonly stepMs: number;
  private readonly maxTicksPerFrame: number;
  private accumulatorMs = 0;
  private tickIndex = 0;
  private pending: Omit<TickAction, 'tick'>[] = [];
  private readonly log: TickAction[] = [];
  private phaseValue: Phase = 'ready';
  private settleCount = 0;
  readonly stats: FixedStepStats = { ticks: 0, droppedMs: 0, framesWithZeroTicks: 0, maxTicksInFrame: 0 };

  /**
   * @param simulate - Pure step function. Return true to request settlement after this tick.
   * @param options - Timing options.
   */
  constructor(private readonly simulate: (tick: number, actions: readonly TickAction[]) => boolean, options: FixedStepOptions = {}) {
    this.stepMs = options.stepMs ?? 16;
    this.maxTicksPerFrame = options.maxTicksPerFrame ?? 8;
  }

  /** @returns Current phase. */
  get phase(): Phase { return this.phaseValue; }
  /** @returns Next tick index to be simulated. */
  get tick(): number { return this.tickIndex; }
  /** @returns Fraction [0,1) of the way to the next tick, for render interpolation only. */
  get alpha(): number { return this.accumulatorMs / this.stepMs; }
  /** @returns Immutable copy of all applied actions (the replay log). */
  get actionLog(): readonly TickAction[] { return this.log.slice(); }

  /** Transitions ready -> playing. Idempotent. */
  begin(): void { if (this.phaseValue === 'ready') this.phaseValue = 'playing'; }

  /**
   * Queues an action for the next tick boundary. Ignored unless playing.
   * @param action - Action without a tick index.
   */
  queue(action: Omit<TickAction, 'tick'>): void { if (this.phaseValue === 'playing') this.pending.push(action); }

  /**
   * Settles exactly once. Further calls are no-ops.
   * @returns true only for the call that performed settlement.
   */
  settle(): boolean {
    if (this.phaseValue === 'settled') return false;
    this.phaseValue = 'settled';
    this.settleCount++;
    return true;
  }

  /** @returns How many times settlement actually ran (must be <= 1). */
  get settlements(): number { return this.settleCount; }

  /**
   * Advances by one rendered frame.
   * @param frameDeltaMs - Real elapsed time since the previous frame.
   * @returns Number of ticks simulated this frame.
   */
  advance(frameDeltaMs: number): number {
    if (this.phaseValue !== 'playing') return 0;
    this.accumulatorMs += Math.max(0, frameDeltaMs);
    let ran = 0;
    while (this.accumulatorMs >= this.stepMs && this.phaseValue === 'playing') {
      if (ran >= this.maxTicksPerFrame) { this.stats.droppedMs += this.accumulatorMs - (this.accumulatorMs % this.stepMs); this.accumulatorMs %= this.stepMs; break; }
      const actions = this.pending.map((a) => ({ ...a, tick: this.tickIndex }));
      this.pending = [];
      this.log.push(...actions);
      const done = this.simulate(this.tickIndex, actions);
      this.tickIndex++; ran++; this.stats.ticks++;
      this.accumulatorMs -= this.stepMs;
      if (done) this.settle();
    }
    if (ran === 0) this.stats.framesWithZeroTicks++;
    this.stats.maxTicksInFrame = Math.max(this.stats.maxTicksInFrame, ran);
    return ran;
  }

  /**
   * Replays a recorded action log tick-by-tick without any frame timing.
   * @param simulate - Fresh simulation step function.
   * @param log - Action log from a previous run.
   * @param ticks - Number of ticks to replay.
   * @returns void
   */
  static replay(simulate: (tick: number, actions: readonly TickAction[]) => boolean, log: readonly TickAction[], ticks: number): void {
    let i = 0;
    for (let t = 0; t < ticks; t++) {
      const actions: TickAction[] = [];
      while (i < log.length && log[i].tick === t) actions.push(log[i++]);
      if (simulate(t, actions)) return;
    }
  }
}
