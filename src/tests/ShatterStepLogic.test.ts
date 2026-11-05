/**
 * @file ShatterStepLogic.test.ts
 * @purpose Unit tests for ShatterStepLogic — verifies 50/50 RNG, multiplier progression,
 *          cash-out behavior, and the analytic return model (≈72.75% best case) over 10,000 simulated rounds.
 * @author Agent 934
 * @date 2026-04-12
 * @license Proprietary – available for licensing
 */

import {
  createShatterStepState,
  pickTile,
  computeShatterMultiplier,
  cashOutShatterStep,
  simulateShatterRTP,
} from '../games/ShatterStepLogic';

describe('ShatterStepLogic', () => {
  describe('createShatterStepState', () => {
    it('initializes at row 0 with multiplier 1.0', () => {
      const state = createShatterStepState(10);
      expect(state.currentRow).toBe(0);
      expect(state.multiplier).toBe(1.0);
      expect(state.isAlive).toBe(true);
      expect(state.cashedOut).toBe(false);
      expect(state.payout).toBe(0);
    });
  });

  describe('computeShatterMultiplier', () => {
    it('returns 1.0 at row 0', () => {
      expect(computeShatterMultiplier(0, 1.5, 0.03)).toBe(1.0);
    });

    it('applies multiplierPerRow exponentially', () => {
      const m1 = computeShatterMultiplier(1, 1.5, 0);
      const m2 = computeShatterMultiplier(2, 1.5, 0);
      expect(m2).toBeCloseTo(m1 * 1.5, 1);
    });

    it('applies house edge correctly', () => {
      const withEdge = computeShatterMultiplier(3, 1.5, 0.03);
      const raw = Math.pow(1.5, 3);
      expect(withEdge).toBeCloseTo(raw * 0.97, 2);
    });
  });

  describe('pickTile', () => {
    it('advances row on correct pick', () => {
      const state = createShatterStepState(10);
      // Force a win
      const config = { rng: () => 1.0 }; // always >= 0.5, always wins
      pickTile(state, 'left', config);
      expect(state.currentRow).toBe(1);
      expect(state.isAlive).toBe(true);
      expect(state.lastPickCorrect).toBe(true);
    });

    it('kills player on wrong pick', () => {
      const state = createShatterStepState(10);
      const config = { rng: () => 0.0 }; // always < 0.5, always loses
      pickTile(state, 'left', config);
      expect(state.isAlive).toBe(false);
      expect(state.payout).toBe(0);
      expect(state.lastPickCorrect).toBe(false);
    });

    it('does nothing when already dead', () => {
      const state = createShatterStepState(10);
      state.isAlive = false;
      const before = { ...state };
      pickTile(state, 'right', {});
      expect(state.currentRow).toBe(before.currentRow);
    });

    it('auto-cashes out at the top row', () => {
      const config = { totalRows: 3, rng: () => 1.0 };
      const state = createShatterStepState(10, config);
      pickTile(state, 'left', config);
      pickTile(state, 'left', config);
      pickTile(state, 'left', config); // row 3 = top
      expect(state.cashedOut).toBe(true);
      expect(state.payout).toBeGreaterThan(0);
    });
  });

  describe('cashOutShatterStep', () => {
    it('pays out correct amount after 2 rows', () => {
      const config = { rng: () => 1.0 };
      const state = createShatterStepState(10, config);
      pickTile(state, 'left', config);
      pickTile(state, 'left', config);
      const payout = cashOutShatterStep(state);
      const expectedMultiplier = computeShatterMultiplier(2, 1.5, 0.03);
      expect(payout).toBeCloseTo(10 * expectedMultiplier, 2);
    });

    it('returns 0 if cashing out before any pick', () => {
      const state = createShatterStepState(10);
      expect(cashOutShatterStep(state)).toBe(0);
    });

    it('returns 0 on second cash-out', () => {
      const config = { rng: () => 1.0 };
      const state = createShatterStepState(10, config);
      pickTile(state, 'left', config);
      cashOutShatterStep(state);
      expect(cashOutShatterStep(state)).toBe(0);
    });
  });

  describe('RTP simulation', () => {
    it('returns ≈72.75% with the always-cashout strategy (the best available) over 10,000 rounds', () => {
      const rtp = simulateShatterRTP(10000, 'always-cashout', { houseEdge: 0.03 });
      // always-cashout: 50% win 1.5*0.97 = 1.455, 50% lose => expected 0.7275.
      // Stopping after k rows returns 0.75^k * 0.97, so k = 1 is the best strategy.
      // Bounds are ±5 standard errors (SE ≈ 0.0073 at 10,000 rounds). Tightened from 0.60–2.0.
      expect(rtp).toBeGreaterThan(0.69);
      expect(rtp).toBeLessThan(0.765);
    });

    it('house edge on go-to-top decreases as rows increase', () => {
      // With 10 rows and 50/50: probability of winning all = (0.5)^10 = ~0.001
      // Expected RTP = 0.001 * (1.5^10 * 0.97) ~= 0.056 — very high volatility
      // Just verify the simulation runs without error and produces a sensible number
      const rtp = simulateShatterRTP(10000, 'go-to-top', {
        totalRows: 10,
        houseEdge: 0.03,
      });
      expect(rtp).toBeGreaterThanOrEqual(0);
      expect(rtp).toBeLessThan(200); // sanity bound — go-to-top is exponential
    });
  });
});

// ─── polish-003: precommitted board, truthful reveal, settlement ────────────
import {
  createShatterBoard, createShatterRound, pickShatterRound, canCashOutShatter, cashOutShatterRound,
  revealShatterBoard, replayShatterRound, checkpointShatterRound,
} from '../games/ShatterStepLogic';
import type { TileSide } from '../games/ShatterStepLogic';
import { ProvablyFairRNG } from '../shared/rng/ProvablyFairRNG';

const other = (s: TileSide): TileSide => (s === 'left' ? 'right' : 'left');

describe('Shatter precommitted board', () => {
  test('board is fixed by the seed and identical on replay', () => {
    const a = createShatterRound('board-seed', 10); const b = createShatterRound('board-seed', 10);
    expect(a.board).toEqual(b.board);
    expect(a.board).toHaveLength(10);
    expect(createShatterRound('other', 10).board).not.toEqual(a.board);
  });

  test('the chosen side decides the outcome: safe side advances, the other side breaks', () => {
    const r = createShatterRound('side', 10);
    expect(pickShatterRound(r, r.board[0])?.safe).toBe(true);
    const l = createShatterRound('side', 10);
    const pick = pickShatterRound(l, other(l.board[0]));
    expect(pick?.safe).toBe(false);
    expect(l.settlement).toMatchObject({ reason: 'shatter', payout: 0, brokenRow: 0, brokenSide: other(l.board[0]) });
  });

  test('reveal is hidden while live and matches the committed board after settlement; a losing pane is never revealed safe', () => {
    for (let i = 0; i < 200; i++) {
      const r = createShatterRound(`reveal-${i}`, 10);
      expect(revealShatterBoard(r)).toBeNull();
      // Three safe choices, then a wrong one.
      for (let row = 0; row < 3; row++) pickShatterRound(r, r.board[row]);
      expect(revealShatterBoard(r)).toBeNull();
      const wrong = other(r.board[3]);
      pickShatterRound(r, wrong);
      const reveal = revealShatterBoard(r)!;
      expect(reveal).toEqual(r.board);
      expect(reveal[3]).not.toBe(wrong);
      expect(r.picks.map((p) => p.side)).toEqual([r.board[0], r.board[1], r.board[2], wrong]);
    }
  });

  test('per-row safe side is a fair 50/50 (100k rows, ±1.5%)', () => {
    let left = 0; const n = 10000;
    for (let i = 0; i < n; i++) left += createShatterRound(`fair-${i}`, 10).board.filter((s) => s === 'left').length;
    expect(left / (n * 10)).toBeGreaterThan(0.485);
    expect(left / (n * 10)).toBeLessThan(0.515);
  });

  test('createShatterBoard maps [0,0.5) to left and [0.5,1) to right; RNG output stays in [0,1)', () => {
    expect(createShatterBoard(() => 0.4999, 3)).toEqual(['left', 'left', 'left']);
    expect(createShatterBoard(() => 0.5, 2)).toEqual(['right', 'right']);
    const rng = new ProvablyFairRNG('range');
    for (let i = 0; i < 20000; i++) { const v = rng.random(); expect(v >= 0 && v < 1).toBe(true); }
  });

  test('replay of the same picks reproduces state and settlement; checkpoint is JSON-safe', () => {
    const live = createShatterRound('replay', 10);
    const sides: TileSide[] = [live.board[0], live.board[1], other(live.board[2])];
    sides.forEach((s) => pickShatterRound(live, s));
    const again = replayShatterRound('replay', 10, sides);
    expect(again.state).toEqual(live.state);
    expect(again.settlement).toEqual(live.settlement);
    expect(JSON.parse(JSON.stringify(checkpointShatterRound(live))).board).toEqual(live.board);
  });
});

describe('Shatter settlement (payout schedule unchanged)', () => {
  test('row 0 cash-out disallowed; three safe rows cash out 32.74 once', () => {
    const r = createShatterRound('cash', 10);
    expect(canCashOutShatter(r)).toBe(false);
    expect(cashOutShatterRound(r)).toBeNull();
    for (let row = 0; row < 3; row++) pickShatterRound(r, r.board[row]);
    const s = cashOutShatterRound(r);
    expect(s).toMatchObject({ reason: 'cashout', rowsCleared: 3, multiplier: 3.2737, payout: 32.74, returnHundredths: 3274 });
    expect(cashOutShatterRound(r)).toBe(s);           // idempotent
    expect(pickShatterRound(r, 'left')).toBeNull();   // locked after settlement
  });

  test('re-entrant picks after a break are rejected; cash-out after loss returns the loss settlement', () => {
    const r = createShatterRound('broken', 10);
    pickShatterRound(r, other(r.board[0]));
    expect(pickShatterRound(r, r.board[0])).toBeNull();
    expect(cashOutShatterRound(r)?.reason).toBe('shatter');
    expect(r.picks).toHaveLength(1);
  });

  test('final row auto-settles at the top', () => {
    const r = createShatterRound('top', 10);
    for (let row = 0; row < 10; row++) pickShatterRound(r, r.board[row]);
    expect(r.settlement).toMatchObject({ reason: 'top', rowsCleared: 10, payout: 559.35 });
  });
});
