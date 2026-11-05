/**
 * @file InfernoPolish.test.ts
 * @purpose Regression tests for inferno-polish-001: exact cluster rules, survivor order, scatter/heat
 *          rules (legacy defaults + measured options), authoritative spin scripts, the exactly-once
 *          session ledger, Crown guards, determinism, outcome-cue policy and the full-cycle simulator.
 * @author Agent 934
 * @date 2026-11-05
 * @license Proprietary – available for licensing
 */

import {
  createInfernoState, spinInferno, evaluateClusters, cascadeInferno, simulateInfernoRTP, simulateInfernoCycles,
  resolveInfernoSpin, resolveInfernoCascades, createInfernoSession, beginInfernoSpin, finishInfernoPresentation,
  crownFlipAction, crownCollectAction, setInfernoStake, isCrownEligible, toMilliCredits, formatCredits,
  classifyCycle, selectInfernoOutcomeCue, getInfernoMathFingerprint, INFERNO_LEGACY_RULES, INFERNO_MATH_VERSION,
} from '../games/InfernoLogic';
import type { InfernoState, InfernoSymbol, InfernoSession, InfernoConfig } from '../games/InfernoLogic';
import { ProvablyFairRNG, createRNG } from '../shared/rng/ProvablyFairRNG';

const BET = 10;

const board = (rows: InfernoSymbol[][], bet = BET): InfernoState => {
  const s = createInfernoState(bet);
  s.grid = rows.map((r, ri) => r.map((symbol, ci) => ({ symbol, row: ri, col: ci, isWinning: false, isFalling: false })));
  return s;
};
const syms = (s: InfernoState): InfernoSymbol[][] => s.grid.map((r) => r.map((c) => c.symbol));
const column = (g: InfernoSymbol[][], c: number): InfernoSymbol[] => g.map((r) => r[c]);

/** Test RNG that serves a fixed symbol queue to weightedChoice and fixed values to random(). */
class QueueRNG extends ProvablyFairRNG {
  private readonly symbols: InfernoSymbol[];
  private readonly randoms: number[];
  constructor(symbols: InfernoSymbol[], randoms: number[] = []) { super('queue'); this.symbols = symbols.slice(); this.randoms = randoms.slice(); }
  public weightedChoice<T>(items: { value: T; weight: number }[]): T {
    if (this.symbols.length) return this.symbols.shift() as unknown as T;
    // deterministic fallback once the queue is empty
    return (items.find((i) => (i.value as unknown) === 'SMOKE') ?? items[0]).value;
  }
  public random(): number { return this.randoms.length ? (this.randoms.shift() as number) : 0.99; }
}

describe('Inferno cluster rules (exact payouts)', () => {
  it('pays a horizontal 3-cluster: bet × base × size multiplier', () => {
    const s = evaluateClusters(board([['EMBER', 'EMBER', 'EMBER'], ['SMOKE', 'ASH', 'COAL'], ['ASH', 'COAL', 'SMOKE']]));
    expect(s.clusters).toHaveLength(1);
    expect(s.totalWin).toBeCloseTo(10 * 0.8 * 1, 10);
  });

  it('pays a vertical 3-cluster', () => {
    const s = evaluateClusters(board([['FLAME', 'ASH', 'COAL'], ['FLAME', 'SMOKE', 'ASH'], ['FLAME', 'COAL', 'SMOKE']]));
    expect(s.clusters.map((c) => [c.symbol, c.cells.length])).toEqual([['FLAME', 3]]);
    expect(s.totalWin).toBeCloseTo(5, 10);
  });

  it('applies the size multiplier to an L-shaped 4-cluster', () => {
    const s = evaluateClusters(board([['COAL', 'COAL', 'ASH'], ['COAL', 'SMOKE', 'FLAME'], ['COAL', 'ASH', 'SMOKE']]));
    expect(s.clusters[0].cells).toHaveLength(4);
    expect(s.totalWin).toBeCloseTo(10 * 0.35 * 2.5, 10);
  });

  it('does not connect diagonals', () => {
    const s = evaluateClusters(board([['EMBER', 'ASH', 'COAL'], ['SMOKE', 'EMBER', 'ASH'], ['COAL', 'SMOKE', 'EMBER']]));
    expect(s.clusters).toHaveLength(0);
    expect(s.totalWin).toBe(0);
  });

  it('lets a WILD bridge two same-symbol cells into one cluster', () => {
    const s = evaluateClusters(board([['ASH', 'WILD', 'ASH'], ['SMOKE', 'COAL', 'FLAME'], ['COAL', 'FLAME', 'SMOKE']]));
    expect(s.clusters.map((c) => [c.symbol, c.cells.length])).toEqual([['ASH', 3]]);
  });

  it('counts one WILD in two different symbol clusters (overlap) but marks it winning once', () => {
    const s = evaluateClusters(board([['EMBER', 'WILD', 'FLAME'], ['EMBER', 'SMOKE', 'FLAME'], ['ASH', 'COAL', 'ASH']]));
    expect(s.clusters.map((c) => c.symbol).sort()).toEqual(['EMBER', 'FLAME']);
    expect(s.totalWin).toBeCloseTo(8 + 5, 10);
    expect(s.grid.flat().filter((c) => c.isWinning)).toHaveLength(5);
  });

  it('LEGACY rule: an all-WILD board has no paying cluster (open product decision)', () => {
    const s = evaluateClusters(board([['WILD', 'WILD', 'WILD'], ['WILD', 'WILD', 'WILD'], ['WILD', 'WILD', 'WILD']]));
    expect(s.clusters).toHaveLength(0);
    expect(s.totalWin).toBe(0);
  });

  it('OPTION pays-as-top-symbol: a WILD-only group pays as EMBER at its size', () => {
    const cfg: InfernoConfig = { rules: { wildOnlyCluster: 'pays-as-top-symbol' } };
    const all = evaluateClusters(board([['WILD', 'WILD', 'WILD'], ['WILD', 'WILD', 'WILD'], ['WILD', 'WILD', 'WILD']]), cfg);
    expect(all.totalWin).toBeCloseTo(10 * 0.8 * 25, 10);
    // WILDs already used by a paying symbol cluster are not paid again as a WILD group
    const mixed = evaluateClusters(board([['ASH', 'WILD', 'WILD'], ['SMOKE', 'COAL', 'WILD'], ['COAL', 'FLAME', 'SMOKE']]), cfg);
    // (under the original overlap rule these WILDs also join COAL and SMOKE clusters)
    expect(mixed.clusters.map((c) => c.symbol)).toEqual(['ASH', 'COAL', 'SMOKE']);
    expect(mixed.clusters.some((c) => c.symbol === 'WILD')).toBe(false);
  });

  it('never includes SCATTER in a cluster', () => {
    const s = evaluateClusters(board([['SCATTER', 'SCATTER', 'SCATTER'], ['SMOKE', 'ASH', 'COAL'], ['ASH', 'COAL', 'SMOKE']]));
    expect(s.clusters).toHaveLength(0);
    expect(s.scatterCount).toBe(3);
  });

  it('is idempotent: re-evaluating the same step does not credit twice', () => {
    const once = evaluateClusters(board([['EMBER', 'EMBER', 'EMBER'], ['SMOKE', 'ASH', 'COAL'], ['ASH', 'COAL', 'SMOKE']]));
    const twice = evaluateClusters(once);
    expect(twice.totalWin).toBe(once.totalWin);
    expect(twice.clusters).toHaveLength(1);
  });
});

describe('Cascade survivor order (gravity)', () => {
  it('keeps a separated survivor pair in top-to-bottom order', () => {
    // column 0: COAL (survivor) / EMBER (removed) / FLAME (survivor)
    const s = evaluateClusters(board([['COAL', 'SMOKE', 'ASH'], ['EMBER', 'EMBER', 'EMBER'], ['FLAME', 'ASH', 'SMOKE']]));
    const after = cascadeInferno(s, { rng: new QueueRNG(['WILD', 'WILD', 'WILD']) });
    expect(column(syms(after), 0)).toEqual(['WILD', 'COAL', 'FLAME']);
    expect(column(syms(after), 1)).toEqual(['WILD', 'SMOKE', 'ASH']);
    expect(column(syms(after), 2)).toEqual(['WILD', 'ASH', 'SMOKE']);
  });

  it('handles multiple removed rows and keeps the single survivor at the bottom', () => {
    const s = evaluateClusters(board([['COAL', 'COAL', 'COAL'], ['ASH', 'ASH', 'ASH'], ['FLAME', 'SMOKE', 'FLAME']]));
    expect(s.clusters).toHaveLength(2);
    const after = cascadeInferno(s, { rng: new QueueRNG(['EMBER', 'SCATTER', 'EMBER', 'SCATTER', 'EMBER', 'SCATTER']) });
    expect(syms(after)).toEqual([['EMBER', 'EMBER', 'EMBER'], ['SCATTER', 'SCATTER', 'SCATTER'], ['FLAME', 'SMOKE', 'FLAME']]);
  });

  it('script moves map every survivor from its old row to its new row', () => {
    const landed = board([['COAL', 'SMOKE', 'ASH'], ['EMBER', 'EMBER', 'EMBER'], ['FLAME', 'ASH', 'SMOKE']]);
    const { steps } = resolveInfernoCascades(landed, { rng: new QueueRNG(['WILD', 'WILD', 'WILD', 'SMOKE', 'SMOKE', 'SMOKE']) });
    const step = steps[0];
    expect(step.gridBefore[1]).toEqual(['EMBER', 'EMBER', 'EMBER']);
    expect(step.winningCells).toHaveLength(3);
    expect(step.moves.filter((m) => m.col === 0)).toEqual([
      { col: 0, fromRow: 0, toRow: 1, symbol: 'COAL' },
      { col: 0, fromRow: 2, toRow: 2, symbol: 'FLAME' },
    ]);
    expect(step.refills.filter((r) => r.col === 0)).toEqual([{ col: 0, toRow: 0, slotsAbove: 1, symbol: 'WILD' }]);
    // applying moves + refills to gridBefore reproduces gridAfter
    const rebuilt: (InfernoSymbol | null)[][] = [[null, null, null], [null, null, null], [null, null, null]];
    step.moves.forEach((m) => { rebuilt[m.toRow][m.col] = m.symbol; });
    step.refills.forEach((r) => { rebuilt[r.toRow][r.col] = r.symbol; });
    expect(rebuilt).toEqual(step.gridAfter);
  });
});

describe('Scatter and heat rules', () => {
  const threeScattersNoCluster: InfernoSymbol[][] = [['SCATTER', 'EMBER', 'FLAME'], ['ASH', 'SCATTER', 'COAL'], ['FLAME', 'SMOKE', 'SCATTER']];

  it('LEGACY rule: 3 scatters without a paying cluster award nothing', () => {
    const { finalState } = resolveInfernoCascades(board(threeScattersNoCluster), { rng: createRNG('s') });
    expect(finalState.scatterCount).toBe(3);
    expect(finalState.freeSpinsRemaining).toBe(0);
  });

  it('OPTION any-landed-board: 3 scatters on the landed board award 5 free spins once', () => {
    const cfg: InfernoConfig = { rng: createRNG('s'), rules: { scatterAward: 'any-landed-board' } };
    const r = resolveInfernoCascades(board(threeScattersNoCluster), cfg);
    expect(r.finalState.freeSpinsRemaining).toBe(5);
    expect(r.freeSpinsAwardedAtLanding).toBe(5);
  });

  it('LEGACY rule: scatters present after a cascade award 5 free spins once per spin', () => {
    const landed = board([['SCATTER', 'COAL', 'SCATTER'], ['ASH', 'COAL', 'SMOKE'], ['FLAME', 'COAL', 'SCATTER']]);
    const r = resolveInfernoCascades(landed, { rng: new QueueRNG(['SMOKE', 'ASH', 'FLAME']) });
    expect(r.steps).toHaveLength(1);
    expect(r.steps[0].freeSpinsAwarded).toBe(5);
    expect(r.finalState.freeSpinsRemaining).toBe(5);
  });

  it('retrigger: a free spin that triggers again adds 5 more (rule retained from the original)', () => {
    // landed free spin with 1 more pending (spinInferno already consumed the current one)
    const s = { ...board([['SCATTER', 'COAL', 'SCATTER'], ['ASH', 'COAL', 'SMOKE'], ['FLAME', 'COAL', 'SCATTER']]), freeSpinsRemaining: 1 };
    const r = resolveInfernoCascades(s, { rng: new QueueRNG(['SMOKE', 'ASH', 'FLAME']) });
    expect(r.finalState.freeSpinsRemaining).toBe(6);
  });

  it('heat +1 per cascade, capped at 5; at 5 the next spin is all WILD and heat resets', () => {
    let s = board([['EMBER', 'EMBER', 'EMBER'], ['SMOKE', 'ASH', 'COAL'], ['ASH', 'COAL', 'SMOKE']]);
    s.heatMeter = 4;
    s = cascadeInferno(evaluateClusters(s), { rng: createRNG('h') });
    expect(s.heatMeter).toBe(5);
    const capped = cascadeInferno(evaluateClusters({ ...board([['EMBER', 'EMBER', 'EMBER'], ['SMOKE', 'ASH', 'COAL'], ['ASH', 'COAL', 'SMOKE']]), heatMeter: 5 }), { rng: createRNG('h') });
    expect(capped.heatMeter).toBe(5);
    const script = resolveInfernoSpin({ ...s, isComplete: true }, { rng: createRNG('inferno') });
    expect(script.isInfernoSpin).toBe(true);
    expect(script.heatAtLanding).toBe(0);
    expect(script.initialGrid.flat().every((x) => x === 'WILD')).toBe(true);
    expect(script.totalWin).toBe(0); // legacy all-WILD rule
  });
});

describe('Authoritative spin script', () => {
  it('is deterministic for the same seed and state', () => {
    const a = resolveInfernoSpin(createInfernoState(BET), { rng: createRNG('det-1') });
    const b = resolveInfernoSpin(createInfernoState(BET), { rng: createRNG('det-1') });
    expect(JSON.stringify(a)).toEqual(JSON.stringify(b));
  });

  it('final totalWin equals the sum of step wins and the last step totals', () => {
    for (let i = 0; i < 300; i++) {
      const sc = resolveInfernoSpin(createInfernoState(BET), { rng: createRNG(`sum-${i}`) });
      const sum = sc.steps.reduce((a, st) => a + st.stepWin, 0);
      expect(sc.totalWin).toBeCloseTo(sum, 9);
      if (sc.steps.length) expect(sc.steps[sc.steps.length - 1].totalWinAfter).toBeCloseTo(sc.totalWin, 9);
      sc.steps.forEach((st, k) => { if (k > 0) expect(st.gridBefore).toEqual(sc.steps[k - 1].gridAfter); });
      if (sc.steps.length) expect(sc.steps[0].gridBefore).toEqual(sc.initialGrid);
    }
  });

  it('matches the original export sequence (spin → evaluate → cascade) for the same RNG', () => {
    for (let i = 0; i < 50; i++) {
      const sc = resolveInfernoSpin(createInfernoState(BET), { rng: createRNG(`eq-${i}`) });
      const rng = createRNG(`eq-${i}`);
      let s = spinInferno(createInfernoState(BET), { rng });
      for (;;) { s = evaluateClusters(s); if (!s.clusters.length) break; s = cascadeInferno(s, { rng }); }
      expect(sc.totalWin).toBe(s.totalWin);
      expect(syms(sc.finalState)).toEqual(syms(s));
    }
  });
});

describe('Session ledger (exactly-once settlement)', () => {
  const fixedConfig = (seed: string): InfernoConfig => ({ rng: createRNG(seed) });
  const playToReady = (session: InfernoSession, seed: string, crown: 'collect' | 'flip' = 'collect'): InfernoSession => {
    const started = beginInfernoSpin(session, fixedConfig(seed));
    let s = started.session;
    const res = finishInfernoPresentation(s, s.roundId);
    s = res.session;
    if (s.phase === 'decision') s = (crown === 'collect' ? crownCollectAction(s, s.roundId) : crownFlipAction(s, s.roundId, fixedConfig(`${seed}-flip`))).session;
    while (s.phase === 'decision') s = crownCollectAction(s, s.roundId).session;
    return s;
  };

  it('debits a paid spin exactly once and credits its return exactly once', () => {
    let s = createInfernoSession(100, 10);
    const r = beginInfernoSpin(s, fixedConfig('l-1'));
    expect(r.session.balanceMilli).toBe(90000);
    expect(r.session.debitCount).toBe(1);
    // a second begin while presenting is rejected (fast double tap)
    expect(beginInfernoSpin(r.session, fixedConfig('l-2')).rejected).toBe('BUSY');
    s = finishInfernoPresentation(r.session, r.session.roundId, false).session;
    // stale / repeated finish is rejected
    expect(finishInfernoPresentation(s, s.roundId, false).rejected).toBe('WRONG_PHASE');
    expect(s.creditCount).toBe(1);
    expect(s.balanceMilli).toBe(90000 + toMilliCredits(r.script!.totalWin));
  });

  it('rejects a paid spin with insufficient balance', () => {
    const s = createInfernoSession(5, 10);
    expect(beginInfernoSpin(s, fixedConfig('x')).rejected).toBe('INSUFFICIENT_BALANCE');
  });

  it('awarded free spins: zero debit, no balance prerequisite, stake fixed for the cycle', () => {
    let s = createInfernoSession(10, 10);
    // open a paid cycle, then simulate an award landing on it
    const started = beginInfernoSpin(s, fixedConfig('free-1')).session;
    s = { ...started, state: { ...started.state, freeSpinsRemaining: 3, totalWin: 0, isComplete: true } };
    s = finishInfernoPresentation(s, s.roundId, false).session;
    expect(s.balanceMilli).toBe(0); // the whole balance was the paid stake
    expect(s.cycle).not.toBeNull();
    // stake changes are locked during the award cycle
    expect(setInfernoStake(s, 50).rejected).toBe('STAKE_LOCKED');
    const debitsBefore = s.debitCount;
    for (let i = 0; i < 3; i++) {
      const r = beginInfernoSpin(s, fixedConfig(`free-run-${i}`));
      expect(r.rejected).toBeUndefined();
      expect(r.script!.isFreeSpin).toBe(true);
      expect(r.script!.stake).toBe(10);
      s = r.session;
      // keep the test bounded: ignore retriggers produced by the random stream
      s = { ...s, state: { ...s.state, freeSpinsRemaining: Math.min(s.state.freeSpinsRemaining, 2 - i) } };
      s = finishInfernoPresentation(s, s.roundId, false).session;
    }
    expect(s.debitCount).toBe(debitsBefore);
    expect(s.cycle).toBeNull();
    expect(s.lastCycle?.spins).toBe(4);
    expect(s.lastCycle?.freeSpins).toBe(3);
    expect(s.creditCount).toBe(4);
  });

  it('Crown collect settles once; repeated or stale callbacks are rejected', () => {
    let s = createInfernoSession(1000, 10);
    let i = 0;
    for (; i < 200; i++) {
      const r = beginInfernoSpin(s, fixedConfig(`crown-${i}`));
      const f = finishInfernoPresentation(r.session, r.session.roundId);
      if (f.session.phase === 'decision') { s = f.session; break; }
      s = f.session;
    }
    expect(s.phase).toBe('decision');
    const roundId = s.roundId;
    const credits = s.creditCount;
    const atRisk = toMilliCredits(s.state.crownFlipWin);
    const before = s.balanceMilli;
    const collected = crownCollectAction(s, roundId);
    expect(collected.settlement?.creditedMilli).toBe(atRisk);
    expect(collected.session.balanceMilli).toBe(before + atRisk);
    expect(crownCollectAction(collected.session, roundId).rejected).toBe('WRONG_PHASE');
    expect(crownFlipAction(collected.session, roundId).rejected).toBe('WRONG_PHASE');
    expect(crownCollectAction(s, roundId - 1).rejected).toBe('STALE_ROUND');
    expect(collected.session.creditCount).toBe(credits + 1);
  });

  it('Crown flip win doubles and stays in decision; loss settles 0 once', () => {
    let s = createInfernoSession(1000, 10);
    for (let i = 0; i < 200 && s.phase !== 'decision'; i++) {
      const r = beginInfernoSpin(s, fixedConfig(`crown2-${i}`));
      s = finishInfernoPresentation(r.session, r.session.roundId).session;
    }
    const amount = s.state.crownFlipWin;
    const win = crownFlipAction(s, s.roundId, { rng: new QueueRNG([], [0.1]) });
    expect(win.settlement).toBeUndefined();
    expect(win.session.phase).toBe('decision');
    expect(win.session.state.crownFlipWin).toBeCloseTo(amount * 2, 9);
    const balance = win.session.balanceMilli;
    const loss = crownFlipAction(win.session, win.session.roundId, { rng: new QueueRNG([], [0.9]) });
    expect(loss.settlement?.creditedMilli).toBe(0);
    expect(loss.session.balanceMilli).toBe(balance);
    expect(loss.session.phase).toBe('ready');
    expect(crownFlipAction(loss.session, loss.session.roundId).rejected).toBe('WRONG_PHASE');
  });

  it('never offers Crown while free spins are pending', () => {
    const st = { ...createInfernoState(10), isComplete: true, totalWin: 5, freeSpinsRemaining: 2 };
    expect(isCrownEligible(st)).toBe(false);
    expect(isCrownEligible({ ...st, freeSpinsRemaining: 0 })).toBe(true);
  });

  it('keeps the ledger exact in milli-credits (no float drift)', () => {
    expect(toMilliCredits(3 * 0.35)).toBe(1050); // 1.0499999999999998 in floating point
    expect(toMilliCredits(1 * 0.15 * 2.5)).toBe(375);
    expect(formatCredits(1234500)).toBe('1,234.50');
  });

  it('is deterministic across a checkpoint/restore of the session', () => {
    let a = createInfernoSession(1000, 10);
    for (let i = 0; i < 5; i++) a = playToReady(a, `ck-${i}`);
    const checkpoint = JSON.parse(JSON.stringify(a)) as InfernoSession;
    let b = checkpoint;
    for (let i = 5; i < 12; i++) { a = playToReady(a, `ck-${i}`); b = playToReady(b, `ck-${i}`); }
    expect(b.balanceMilli).toBe(a.balanceMilli);
    expect(b.state.heatMeter).toBe(a.state.heatMeter);
    expect(b.ledger).toEqual(a.ledger);
  });
});

describe('Outcome cue policy (no celebration below stake)', () => {
  const st = (paid: number, ret: number, complete = true) => ({
    roundId: 1, creditedMilli: ret, cycleComplete: complete, cyclePaidMilli: paid, cycleReturnedMilli: ret,
    cycleOutcome: classifyCycle({ paidStakeMilli: paid, returnedMilli: ret }, complete),
  });
  it('plays the profit motif only for a closed cycle returning more than its paid stake', () => {
    expect(selectInfernoOutcomeCue(st(10000, 10001))).toBe('profit');
    expect(selectInfernoOutcomeCue(st(10000, 10000))).toBe('neutral');
    expect(selectInfernoOutcomeCue(st(10000, 4000))).toBe('neutral');
    expect(selectInfernoOutcomeCue(st(10000, 0))).toBe('neutral');
    expect(selectInfernoOutcomeCue(st(10000, 50000, false))).toBe('none'); // free spins pending
  });
});

describe('Full-cycle simulator (production functions)', () => {
  it('carries heat between paid cycles (Inferno Spins occur) and counts only paid stakes', () => {
    const stats = simulateInfernoCycles(400, 1, { rng: createRNG('sim-carry') });
    expect(stats.paidCycles).toBe(400);
    expect(stats.totalPaidMilli).toBe(400 * 1000);
    expect(stats.infernoSpins).toBeGreaterThan(0);
    expect(stats.pendingFreeSpinsAtEnd).toBe(0);
    expect(stats.unresolvedSpins).toBe(0);
    expect(stats.nonFiniteEvents).toBe(0);
  });

  it('simulateInfernoRTP is deterministic and within the AGENTS.md sanity band (not a 96% claim)', () => {
    const a = simulateInfernoRTP(1500, 1, { rng: createRNG('rtp-sanity') });
    const b = simulateInfernoRTP(1500, 1, { rng: createRNG('rtp-sanity') });
    expect(a).toBe(b);
    expect(a).toBeGreaterThan(0.5);
    expect(a).toBeLessThan(1.0);
  });

  it('exposes a stable math fingerprint and version', () => {
    expect(INFERNO_MATH_VERSION).toBe('inferno-math-2');
    expect(getInfernoMathFingerprint().hash).toMatch(/^[0-9a-f]{8}$/);
    expect(getInfernoMathFingerprint().hash).not.toBe(getInfernoMathFingerprint({ rules: { wildOnlyCluster: 'pays-as-top-symbol' } }).hash);
    expect(INFERNO_LEGACY_RULES).toEqual({ wildOnlyCluster: 'no-pay', scatterAward: 'after-cascade-only' });
  });
});
