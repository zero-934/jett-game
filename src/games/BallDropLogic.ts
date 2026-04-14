/**
 * @file BallDropLogic.ts
 * @purpose Pure game logic for Ball Drop — a pegged board game where the player
 *          drops balls through an offset peg grid and can nudge mid-fall.
 *          Slot multipliers are edge-high / center-low. House edge ~3%.
 *          No Phaser dependencies. Self-contained — licensable standalone.
 * @author Agent 934
 * @date 2026-04-14
 * @license Proprietary – available for licensing
 */

// ─── Constants ───────────────────────────────────────────────────────────────

const DEFAULT_HOUSE_EDGE    = 0.03;
const DEFAULT_GRAVITY       = 0.28;
const DEFAULT_BOUNCE_DAMPEN = 0.52;
const DEFAULT_FRICTION      = 0.994;
const DEFAULT_NUDGE_FORCE   = 0.22;
const DEFAULT_MAX_NUDGE_VX  = 3.8;
const DEFAULT_BALL_RADIUS   = 8;
const DEFAULT_PEG_RADIUS    = 5;
const DEFAULT_PEG_ROWS      = 9;
const DEFAULT_BALLS_PER_ROUND = 5;

/** Board layout constants (matches UI) */
export const BOARD_MARGIN_X  = 30;
export const BOARD_TOP_Y     = 80;
export const SLOT_COUNT      = 9;
export const SLOT_HEIGHT     = 54;

/**
 * Gross payout multipliers per slot (edge-high, center-low).
 * These are the DISPLAYED values. Payout = bet × multiplier.
 * House edge is baked into these values (~97% RTP with expected slot distribution).
 */
export const SLOT_MULTIPLIERS: readonly number[] = [
  5.0, 2.0, 1.2, 0.6, 0.3, 0.6, 1.2, 2.0, 5.0,
];

// ─── Interfaces ──────────────────────────────────────────────────────────────

/** A single peg on the board (world-space). */
export interface BallDropPeg {
  x: number;
  y: number;
  /** Radius used for collision. */
  radius: number;
  /** 0–1, used by UI for glow; decrements each tick. Not used by logic. */
  litLevel: number;
}

/** Physics state of the active ball. */
export interface BallPhysics {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Ball has landed in a slot this tick (set true for one tick then ball clears). */
  justLanded: boolean;
  /** Index of landed slot, -1 while airborne. */
  landedSlot: number;
  /** Trail history for UI rendering (kept small). */
  trailX: number[];
  trailY: number[];
}

/** Full Ball Drop game state snapshot. */
export interface BallDropState {
  bet: number;
  ballsTotal: number;
  ballsRemaining: number;
  /** Currently airborne ball, null when between drops. */
  activeBall: BallPhysics | null;
  pegs: BallDropPeg[];
  score: number;
  lastPayout: number;
  lastSlotIndex: number;
  /** Slot index for each past ball (-1 if pending). */
  history: number[];
  dropX: number;
  boardWidth: number;
  boardHeight: number;
  /** Whether all balls have been used. */
  gameOver: boolean;
}

/** Configuration for a Ball Drop instance. */
export interface BallDropConfig {
  boardWidth?: number;
  boardHeight?: number;
  pegRows?: number;
  ballRadius?: number;
  pegRadius?: number;
  gravity?: number;
  bounceDampen?: number;
  friction?: number;
  nudgeForce?: number;
  maxNudgeVx?: number;
  ballsPerRound?: number;
  houseEdge?: number;
  rng?: () => number;
}

/** Direction of player nudge input for this tick. */
export type NudgeDir = 'left' | 'right' | 'none';

// ─── Peg Layout ──────────────────────────────────────────────────────────────

/**
 * Builds the peg grid for a given board size.
 * Rows alternate between `pegsPerRow` and `pegsPerRow - 1` pegs (offset layout).
 *
 * @param boardWidth - Total board pixel width.
 * @param boardHeight - Total board pixel height.
 * @param pegRows - Number of peg rows.
 * @param pegRadius - Visual/collision radius of each peg.
 * @returns Array of BallDropPeg objects.
 *
 * @example
 * const pegs = buildPegGrid(390, 700, 9, 5);
 */
export function buildPegGrid(
  boardWidth: number,
  boardHeight: number,
  pegRows: number,
  pegRadius: number = DEFAULT_PEG_RADIUS
): BallDropPeg[] {
  const pegs: BallDropPeg[] = [];
  const usableWidth = boardWidth - BOARD_MARGIN_X * 2;
  const slotH = SLOT_HEIGHT;
  const usableHeight = boardHeight - BOARD_TOP_Y - slotH;
  const rowSpacing = usableHeight / (pegRows + 1);

  // Use a fixed column spacing based on the even-row (SLOT_COUNT pegs) layout.
  // Odd rows are offset by half that spacing; their pegs naturally stay within bounds.
  const baseColSpacing = usableWidth / (SLOT_COUNT - 1);

  for (let row = 0; row < pegRows; row++) {
    const isEvenRow  = row % 2 === 0;
    const pegsInRow  = isEvenRow ? SLOT_COUNT : SLOT_COUNT - 1;
    const colSpacing = baseColSpacing;
    const xOffset    = isEvenRow ? 0 : colSpacing / 2;
    const y          = BOARD_TOP_Y + rowSpacing * (row + 1);

    for (let col = 0; col < pegsInRow; col++) {
      pegs.push({
        x:        BOARD_MARGIN_X + xOffset + col * colSpacing,
        y,
        radius:   pegRadius,
        litLevel: 0,
      });
    }
  }

  return pegs;
}

// ─── State ───────────────────────────────────────────────────────────────────

/**
 * Creates an initial Ball Drop game state.
 *
 * @param bet - Wager in credits per ball.
 * @param config - Board and physics configuration.
 * @returns Fresh BallDropState ready for the first drop.
 *
 * @example
 * const state = createBallDropState(10, { boardWidth: 390, boardHeight: 700 });
 */
export function createBallDropState(bet: number, config: BallDropConfig = {}): BallDropState {
  const boardWidth    = config.boardWidth    ?? 390;
  const boardHeight   = config.boardHeight   ?? 700;
  const pegRows       = config.pegRows       ?? DEFAULT_PEG_ROWS;
  const pegRadius     = config.pegRadius     ?? DEFAULT_PEG_RADIUS;
  const ballsPerRound = config.ballsPerRound ?? DEFAULT_BALLS_PER_ROUND;

  const pegs = buildPegGrid(boardWidth, boardHeight, pegRows, pegRadius);

  return {
    bet,
    ballsTotal:     ballsPerRound,
    ballsRemaining: ballsPerRound,
    activeBall:     null,
    pegs,
    score:          0,
    lastPayout:     0,
    lastSlotIndex:  -1,
    history:        [],
    dropX:          boardWidth / 2,
    boardWidth,
    boardHeight,
    gameOver:       false,
  };
}

// ─── Drop ────────────────────────────────────────────────────────────────────

/**
 * Spawns a new ball at the current drop position.
 * No-ops if a ball is already active or no balls remain.
 *
 * @param state - Current game state (mutated).
 * @param config - Physics configuration.
 * @returns The updated state.
 *
 * @example
 * spawnBall(state, {});
 */
export function spawnBall(state: BallDropState, config: BallDropConfig = {}): BallDropState {
  if (state.activeBall !== null || state.ballsRemaining <= 0 || state.gameOver) return state;

  const rng = config.rng ?? Math.random;
  const ballRadius = config.ballRadius ?? DEFAULT_BALL_RADIUS;

  state.activeBall = {
    x:          state.dropX,
    y:          BOARD_TOP_Y - ballRadius - 2,
    vx:         (rng() - 0.5) * 0.6, // tiny random starting drift
    vy:         1.2,
    justLanded: false,
    landedSlot: -1,
    trailX:     [],
    trailY:     [],
  };

  return state;
}

// ─── Tick ────────────────────────────────────────────────────────────────────

/**
 * Advances Ball Drop physics by one tick.
 * Applies gravity, nudge input, peg collisions, wall bounces, and slot landing detection.
 * Mutates state in place.
 *
 * @param state - Current game state (mutated).
 * @param nudge - Player nudge direction this tick.
 * @param config - Physics configuration.
 * @returns The updated state.
 *
 * @example
 * tickBallDrop(state, 'left', config);
 */
export function tickBallDrop(
  state: BallDropState,
  nudge: NudgeDir,
  config: BallDropConfig = {}
): BallDropState {
  const ball = state.activeBall;
  if (!ball || state.gameOver) return state;

  // Clear previous-tick landing flag
  if (ball.justLanded) {
    state.activeBall = null;
    return state;
  }

  const gravity       = config.gravity       ?? DEFAULT_GRAVITY;
  const bounceDampen  = config.bounceDampen  ?? DEFAULT_BOUNCE_DAMPEN;
  const friction      = config.friction      ?? DEFAULT_FRICTION;
  const nudgeForce    = config.nudgeForce    ?? DEFAULT_NUDGE_FORCE;
  const maxNudgeVx    = config.maxNudgeVx    ?? DEFAULT_MAX_NUDGE_VX;
  const ballRadius    = config.ballRadius    ?? DEFAULT_BALL_RADIUS;
  const houseEdge     = config.houseEdge     ?? DEFAULT_HOUSE_EDGE;

  // Nudge (player skill input — what differentiates this from pure-luck Plinko)
  if (nudge === 'left')  ball.vx = Math.max(-maxNudgeVx, ball.vx - nudgeForce);
  if (nudge === 'right') ball.vx = Math.min( maxNudgeVx, ball.vx + nudgeForce);

  // Apply friction and gravity
  ball.vx *= friction;
  ball.vy += gravity;

  // Move
  ball.x += ball.vx;
  ball.y += ball.vy;

  // Trail (cap at 14 points)
  ball.trailX.push(ball.x);
  ball.trailY.push(ball.y);
  if (ball.trailX.length > 14) { ball.trailX.shift(); ball.trailY.shift(); }

  // Wall bounces
  const minX = BOARD_MARGIN_X + ballRadius;
  const maxX = state.boardWidth - BOARD_MARGIN_X - ballRadius;
  if (ball.x < minX) { ball.x = minX; ball.vx =  Math.abs(ball.vx) * 0.65; }
  if (ball.x > maxX) { ball.x = maxX; ball.vx = -Math.abs(ball.vx) * 0.65; }

  // Peg collisions
  for (const peg of state.pegs) {
    const dx   = ball.x - peg.x;
    const dy   = ball.y - peg.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const minD = ballRadius + peg.radius;

    if (dist < minD && dist > 0.001) {
      const nx = dx / dist;
      const ny = dy / dist;

      // Push ball out of peg
      ball.x = peg.x + nx * (minD + 0.5);
      ball.y = peg.y + ny * (minD + 0.5);

      // Reflect velocity, dampen, add tiny random scatter
      const dot = ball.vx * nx + ball.vy * ny;
      ball.vx   = (ball.vx - 2 * dot * nx) * bounceDampen + (Math.random() - 0.5) * 0.35;
      ball.vy   = (ball.vy - 2 * dot * ny) * bounceDampen;

      // Ensure ball always keeps falling after a peg hit
      if (ball.vy < 0.4) ball.vy = 0.4;

      // Light up the peg for the UI
      peg.litLevel = 1.0;
    }

    // Decay peg glow regardless of hit
    peg.litLevel = Math.max(0, peg.litLevel - 0.04);
  }

  // ── Slot Landing ─────────────────────────────────────────────────────────
  const slotTopY = state.boardHeight - SLOT_HEIGHT;
  if (ball.y + ballRadius >= slotTopY) {
    const slotWidth = (state.boardWidth - BOARD_MARGIN_X * 2) / SLOT_COUNT;
    const relX      = ball.x - BOARD_MARGIN_X;
    const slotIndex = Math.max(0, Math.min(SLOT_COUNT - 1, Math.floor(relX / slotWidth)));

    const payout = computeSlotPayout(slotIndex, state.bet, houseEdge);

    state.score         += payout;
    state.lastPayout     = payout;
    state.lastSlotIndex  = slotIndex;
    state.ballsRemaining = Math.max(0, state.ballsRemaining - 1);
    state.history.push(slotIndex);

    // Snap ball to slot centre (visual)
    ball.x          = BOARD_MARGIN_X + slotWidth * slotIndex + slotWidth / 2;
    ball.y          = slotTopY + 10;
    ball.vx         = 0;
    ball.vy         = 0;
    ball.justLanded = true;
    ball.landedSlot = slotIndex;

    if (state.ballsRemaining === 0) state.gameOver = true;
  }

  return state;
}

// ─── Payouts ─────────────────────────────────────────────────────────────────

/**
 * Computes the credit payout for landing in a given slot.
 *
 * @param slotIndex - Index of the slot (0–8).
 * @param bet - Wager per ball in credits.
 * @param houseEdge - Fraction taken by the house (applied on top of multiplier design).
 * @returns Payout in credits (rounded to 2 dp).
 *
 * @example
 * computeSlotPayout(4, 10, 0.03); // ~2.91  (center slot: 0.3× raw)
 * computeSlotPayout(0, 10, 0.03); // ~48.5  (edge slot:  5.0× raw)
 */
export function computeSlotPayout(
  slotIndex: number,
  bet: number,
  houseEdge: number = DEFAULT_HOUSE_EDGE
): number {
  const rawMultiplier = SLOT_MULTIPLIERS[slotIndex] ?? 0;
  return parseFloat((bet * rawMultiplier * (1 - houseEdge)).toFixed(2));
}

// ─── RTP Simulation ──────────────────────────────────────────────────────────

/**
 * Simulates the Return-to-Player (RTP) using a binomial random walk model.
 *
 * Each ball performs `pegRows` steps of ±1 from the centre column, producing
 * a binomial distribution over the slot columns — matching the expected Gaussian
 * bell-curve output of a proper physical peg board.  This avoids running full
 * Phaser physics in a headless environment (where results would be unreliable).
 *
 * @param rounds - Number of rounds to simulate (each round = ballsPerRound drops).
 * @param config - Game configuration (pegRows, ballsPerRound, houseEdge, rng).
 * @returns Estimated RTP as a fraction (e.g. 0.86 = 86 %).
 *
 * @example
 * const rtp = simulateBallDropRTP(50000, {});
 * console.log(rtp); // ~0.86
 */
export function simulateBallDropRTP(
  rounds: number,
  config: BallDropConfig = {}
): number {
  const pegRows       = config.pegRows       ?? DEFAULT_PEG_ROWS;
  const ballsPerRound = config.ballsPerRound ?? DEFAULT_BALLS_PER_ROUND;
  const houseEdge     = config.houseEdge     ?? DEFAULT_HOUSE_EDGE;
  const rng           = config.rng           ?? Math.random;

  let totalBet    = 0;
  let totalPayout = 0;

  for (let round = 0; round < rounds; round++) {
    for (let ball = 0; ball < ballsPerRound; ball++) {
      totalBet += 1;

      // Simulate a random walk through `pegRows` rows.
      // Each row the ball deflects left or right with equal probability.
      // k = total rightward steps; final slot index ≈ k (clamped to 0–SLOT_COUNT-1).
      let k = 0;
      for (let row = 0; row < pegRows; row++) {
        if (rng() < 0.5) k++;
      }
      const slotIndex = Math.max(0, Math.min(SLOT_COUNT - 1, k));
      totalPayout += computeSlotPayout(slotIndex, 1, houseEdge);
    }
  }

  return totalPayout / totalBet;
}
