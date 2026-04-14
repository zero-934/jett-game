/**
 * @file BallDropLogic.test.ts
 * @purpose Unit tests for BallDropLogic — verifies payout maths, RTP / house edge,
 *          peg grid layout, ball physics lifecycle, and edge cases.
 * @author Agent 934
 * @date 2026-04-14
 * @license Proprietary – available for licensing
 */

import {
  buildPegGrid,
  createBallDropState,
  spawnBall,
  tickBallDrop,
  computeSlotPayout,
  simulateBallDropRTP,
  SLOT_MULTIPLIERS,
  SLOT_COUNT,
  BOARD_MARGIN_X,
  BOARD_TOP_Y,
  SLOT_HEIGHT,
} from '../games/BallDropLogic';

// ─── Peg Grid ────────────────────────────────────────────────────────────────

describe('buildPegGrid', () => {
  it('creates pegs for every row', () => {
    const pegs = buildPegGrid(390, 700, 9, 5);
    expect(pegs.length).toBeGreaterThan(0);
  });

  it('all pegs are within board X bounds', () => {
    const pegs = buildPegGrid(390, 700, 9, 5);
    for (const peg of pegs) {
      expect(peg.x).toBeGreaterThanOrEqual(BOARD_MARGIN_X - 1);
      expect(peg.x).toBeLessThanOrEqual(390 - BOARD_MARGIN_X + 1);
    }
  });

  it('all pegs are within board Y bounds', () => {
    const pegs = buildPegGrid(390, 700, 9, 5);
    for (const peg of pegs) {
      expect(peg.y).toBeGreaterThanOrEqual(BOARD_TOP_Y);
      expect(peg.y).toBeLessThanOrEqual(700 - SLOT_HEIGHT);
    }
  });

  it('pegs start with litLevel 0', () => {
    const pegs = buildPegGrid(390, 700, 9, 5);
    for (const peg of pegs) {
      expect(peg.litLevel).toBe(0);
    }
  });
});

// ─── State creation ──────────────────────────────────────────────────────────

describe('createBallDropState', () => {
  it('initialises with correct ball count', () => {
    const state = createBallDropState(10, { ballsPerRound: 5 });
    expect(state.ballsRemaining).toBe(5);
    expect(state.ballsTotal).toBe(5);
  });

  it('starts with no active ball and score 0', () => {
    const state = createBallDropState(10, {});
    expect(state.activeBall).toBeNull();
    expect(state.score).toBe(0);
    expect(state.gameOver).toBe(false);
  });

  it('stores the supplied bet', () => {
    const state = createBallDropState(25, {});
    expect(state.bet).toBe(25);
  });
});

// ─── Spawning ────────────────────────────────────────────────────────────────

describe('spawnBall', () => {
  it('creates an active ball when none is present', () => {
    const state = createBallDropState(10, {});
    spawnBall(state, {});
    expect(state.activeBall).not.toBeNull();
  });

  it('does not spawn when a ball is already active', () => {
    const state = createBallDropState(10, {});
    spawnBall(state, {});
    const ball1 = state.activeBall;
    spawnBall(state, {});
    expect(state.activeBall).toBe(ball1);
  });

  it('does not spawn when no balls remain', () => {
    const state = createBallDropState(10, { ballsPerRound: 0 });
    spawnBall(state, {});
    expect(state.activeBall).toBeNull();
  });

  it('ball starts above the board top', () => {
    const state = createBallDropState(10, {});
    spawnBall(state, {});
    expect(state.activeBall!.y).toBeLessThan(BOARD_TOP_Y);
  });
});

// ─── Slot Payout ─────────────────────────────────────────────────────────────

describe('computeSlotPayout', () => {
  it('returns 0 for a bet of 0', () => {
    expect(computeSlotPayout(0, 0, 0.03)).toBe(0);
  });

  it('applies house edge correctly on the jackpot slot', () => {
    // slot 0 = ×5.0, houseEdge 3 % → 5 × 10 × 0.97 = 48.5
    const payout = computeSlotPayout(0, 10, 0.03);
    expect(payout).toBeCloseTo(48.5, 1);
  });

  it('centre slot pays less than edge slots', () => {
    const centre = computeSlotPayout(4, 10, 0.03);
    const edge   = computeSlotPayout(0, 10, 0.03);
    expect(edge).toBeGreaterThan(centre);
  });

  it('slot count matches SLOT_MULTIPLIERS length', () => {
    expect(SLOT_MULTIPLIERS.length).toBe(SLOT_COUNT);
  });
});

// ─── Physics ─────────────────────────────────────────────────────────────────

describe('tickBallDrop', () => {
  it('ball falls (y increases) each tick', () => {
    const state = createBallDropState(10, { boardWidth: 390, boardHeight: 700 });
    spawnBall(state, {});
    const y0 = state.activeBall!.y;
    tickBallDrop(state, 'none', {});
    expect(state.activeBall!.y).toBeGreaterThan(y0);
  });

  it('nudge-left decreases vx', () => {
    const state = createBallDropState(10, { boardWidth: 390, boardHeight: 700 });
    spawnBall(state, {});
    state.activeBall!.vx = 0;
    tickBallDrop(state, 'left', { nudgeForce: 0.22 });
    expect(state.activeBall!.vx).toBeLessThan(0);
  });

  it('nudge-right increases vx', () => {
    const state = createBallDropState(10, { boardWidth: 390, boardHeight: 700 });
    spawnBall(state, {});
    state.activeBall!.vx = 0;
    tickBallDrop(state, 'right', { nudgeForce: 0.22 });
    expect(state.activeBall!.vx).toBeGreaterThan(0);
  });

  it('ball does not escape the left wall', () => {
    const state = createBallDropState(10, { boardWidth: 390, boardHeight: 700 });
    spawnBall(state, {});
    state.activeBall!.x  = BOARD_MARGIN_X - 30;
    state.activeBall!.vx = -5;
    tickBallDrop(state, 'none', {});
    expect(state.activeBall!.x).toBeGreaterThanOrEqual(BOARD_MARGIN_X);
  });

  it('ball does not escape the right wall', () => {
    const state = createBallDropState(10, { boardWidth: 390, boardHeight: 700 });
    spawnBall(state, {});
    state.activeBall!.x  = 390 - BOARD_MARGIN_X + 30;
    state.activeBall!.vx = 5;
    tickBallDrop(state, 'none', {});
    expect(state.activeBall!.x).toBeLessThanOrEqual(390 - BOARD_MARGIN_X);
  });

  it('ball lands, records slot, decrements remaining', () => {
    const cfg   = { boardWidth: 390, boardHeight: 700, pegRows: 2 }; // few rows = fast landing
    const state = createBallDropState(10, cfg);
    spawnBall(state, cfg);

    let ticks = 0;
    while (state.activeBall !== null && ticks < 3000) {
      tickBallDrop(state, 'none', cfg);
      ticks++;
    }

    expect(state.ballsRemaining).toBe(4);
    expect(state.lastSlotIndex).toBeGreaterThanOrEqual(0);
    expect(state.lastSlotIndex).toBeLessThan(SLOT_COUNT);
    expect(state.score).toBeGreaterThanOrEqual(0);
  });

  it('gameOver triggers after all balls land', () => {
    const cfg   = { boardWidth: 390, boardHeight: 700, pegRows: 2, ballsPerRound: 2 };
    const state = createBallDropState(10, cfg);

    for (let b = 0; b < 2; b++) {
      spawnBall(state, cfg);
      let ticks = 0;
      while (state.activeBall !== null && ticks < 3000) {
        tickBallDrop(state, 'none', cfg);
        ticks++;
      }
    }

    expect(state.gameOver).toBe(true);
  });
});

// ─── RTP / House Edge ────────────────────────────────────────────────────────

describe('simulateBallDropRTP', () => {
  it('RTP is within 50–100 % (binomial walk model, centre-heavy)', () => {
    // Binomial walk → bell-curve distribution → centre slots dominate.
    // Centre multiplier is 0.3×, edge is 5×. Expected RTP is ~75–90 % analytically.
    const rtp = simulateBallDropRTP(10000, { ballsPerRound: 1 });
    expect(rtp).toBeGreaterThan(0.50);
    expect(rtp).toBeLessThan(1.00);
  });

  /**
   * House edge verification: RTP must always be below 1.0.
   * With houseEdge=0.03 the payout multipliers are discounted by 3 %; the simulation
   * must never return a payout ≥ bet (i.e. RTP ≥ 1.0).
   */
  it('RTP is strictly below 1.0 — house edge is always present', () => {
    const rtp = simulateBallDropRTP(20000, { ballsPerRound: 1, houseEdge: 0.03 });
    expect(rtp).toBeGreaterThan(0.10);
    expect(rtp).toBeLessThan(1.00);
  });
});
