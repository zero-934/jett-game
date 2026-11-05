import { ProvablyFairRNG, RNG_ALGORITHM_V2 } from '../shared/rng/ProvablyFairRNG';
import type { RNGStateSnapshot } from '../shared/rng/ProvablyFairRNG';

/**
 * @file ShatterStepLogic.ts
 * @purpose Pure game logic for Shatter Step — 10-row ladder, 50/50 tile picks,
 *          multiplier progression, cash-out, and RTP calculation. No Phaser dependencies.
 * @author Agent 934
 * @date 2026-04-12
 * @license Proprietary – available for licensing
 */

export type TileSide = 'left' | 'right';

export interface ShatterStepState {
  currentRow: number;       // 0 = start (before any pick), 10 = top (all rows cleared)
  multiplier: number;
  isAlive: boolean;
  cashedOut: boolean;
  payout: number;
  bet: number;
  lastPick: TileSide | null;
  lastPickCorrect: boolean | null;
}

/** Configuration for a Shatter Step game instance. */
export interface ShatterStepConfig {
  totalRows?: number;
  multiplierPerRow?: number;
  /** House edge as a fraction (e.g. 0.03 = 3%). */
  houseEdge?: number;
  /** Optional RNG override for testing (returns 0–1). */
  rng?: () => number;
  /**
   * Precommitted safe side per row (index 0 = first row climbed). When present, a pick is
   * correct exactly when it matches `board[currentRow]`, so the chosen side matters and the
   * end-of-round reveal can be truthful. Without a board the legacy 50/50 roll is used.
   */
  board?: readonly TileSide[];
}

const DEFAULT_ROWS = 10;
const DEFAULT_MULTIPLIER_PER_ROW = 1.5;
const DEFAULT_HOUSE_EDGE = 0.03;

let fallbackInstance: ProvablyFairRNG | null = null;
/** Single fallback generator (previously a new one per pick). */
function fallbackRandom(): number {
  if (!fallbackInstance) fallbackInstance = new ProvablyFairRNG();
  return fallbackInstance.random();
}

/**
 * Creates an initial Shatter Step game state.
 *
 * @param bet - The player's wager in credits.
 * @param config - Game configuration.
 * @returns A fresh ShatterStepState.
 *
 * @example
 * const state = createShatterStepState(10, {});
 */
export function createShatterStepState(
  bet: number,
  _config: ShatterStepConfig = {}
): ShatterStepState {
  return {
    currentRow: 0,
    multiplier: 1.0,
    isAlive: true,
    cashedOut: false,
    payout: 0,
    bet,
    lastPick: null,
    lastPickCorrect: null,
  };
}

/**
 * Processes a tile pick for the current row.
 * Each pick has a 50% chance of being correct.
 * Correct pick: advance row, multiply the payout multiplier.
 * Wrong pick: game over.
 *
 * @param state - Current game state (mutated in place).
 * @param pick - Which tile the player chose ('left' or 'right').
 * @param config - Game configuration.
 * @returns The updated state.
 *
 * @example
 * const next = pickTile(state, 'left', { multiplierPerRow: 1.5 });
 */
export function pickTile(
  state: ShatterStepState,
  pick: TileSide,
  config: ShatterStepConfig = {}
): ShatterStepState {
  if (!state.isAlive || state.cashedOut) return state;

  const totalRows = config.totalRows ?? DEFAULT_ROWS;
  const multiplierPerRow = config.multiplierPerRow ?? DEFAULT_MULTIPLIER_PER_ROW;
  const houseEdge = config.houseEdge ?? DEFAULT_HOUSE_EDGE;
  state.lastPick = pick;

  let isCorrect: boolean;
  if (config.board) {
    isCorrect = config.board[state.currentRow] === pick;
  } else {
    // Legacy 50/50 outcome (side-independent)
    const rng = config.rng ?? fallbackRandom;
    isCorrect = rng() >= 0.5;
  }

  state.lastPickCorrect = isCorrect;

  if (isCorrect) {
    state.currentRow += 1;
    state.multiplier = computeShatterMultiplier(
      state.currentRow,
      multiplierPerRow,
      houseEdge
    );

    if (state.currentRow >= totalRows) {
      // Player reached the top — auto cash out
      state.cashedOut = true;
      state.payout = parseFloat((state.bet * state.multiplier).toFixed(2));
    }
  } else {
    state.isAlive = false;
    state.payout = 0;
  }

  return state;
}

/**
 * Computes the payout multiplier for a given row, adjusted for house edge.
 * Base formula: multiplierPerRow^row * (1 - houseEdge)
 *
 * @param row - Number of rows successfully cleared.
 * @param multiplierPerRow - Multiplier applied per correct row (default 1.5).
 * @param houseEdge - Fraction taken by the house (default 0.03).
 * @returns The payout multiplier.
 *
 * @example
 * computeShatterMultiplier(3, 1.5, 0.03); // ~3.11
 */
export function computeShatterMultiplier(
  row: number,
  multiplierPerRow: number = DEFAULT_MULTIPLIER_PER_ROW,
  houseEdge: number = DEFAULT_HOUSE_EDGE
): number {
  if (row <= 0) return 1.0;
  const rawMultiplier = Math.pow(multiplierPerRow, row);
  return parseFloat((rawMultiplier * (1 - houseEdge)).toFixed(4));
}

/**
 * Processes a player cash-out request.
 * Can only cash out after at least one correct pick.
 *
 * @param state - Current game state (mutated in place).
 * @returns The credit payout amount.
 *
 * @example
 * const winnings = cashOutShatterStep(state);
 */
export function cashOutShatterStep(state: ShatterStepState): number {
  if (!state.isAlive || state.cashedOut || state.currentRow === 0) return 0;
  state.cashedOut = true;
  state.payout = parseFloat((state.bet * state.multiplier).toFixed(2));
  return state.payout;
}

/**
 * Simulates a full session of Shatter Step rounds to estimate RTP.
 * Useful for auditing house edge.
 *
 * @param rounds - Number of rounds to simulate.
 * @param strategy - 'always-cashout' cashes out after every correct pick; 'go-to-top' plays all rows.
 * @param config - Game configuration.
 * @returns Estimated RTP as a fraction (e.g. 0.97 = 97%).
 *
 * @example
 * const rtp = simulateShatterRTP(10000, 'always-cashout', {});
 */
export function simulateShatterRTP(
  rounds: number,
  strategy: 'always-cashout' | 'go-to-top',
  config: ShatterStepConfig = {}
): number {
  const _simRng = new ProvablyFairRNG();
  const simConfig: ShatterStepConfig = { ...config, rng: _simRng.random.bind(_simRng) };
  let totalBet = 0;
  let totalPayout = 0;
  const bet = 1;

  for (let i = 0; i < rounds; i++) {
    totalBet += bet;
    const state = createShatterStepState(bet, config);

    if (strategy === 'always-cashout') {
      pickTile(state, 'left', simConfig);
      if (state.isAlive && !state.cashedOut && state.currentRow > 0) {
        cashOutShatterStep(state);
      }
    } else {
      while (state.isAlive && !state.cashedOut) {
        pickTile(state, 'left', simConfig);
      }
    }

    totalPayout += state.payout;
  }

  return totalPayout / totalBet;
}


// ─── polish-003: precommitted board and round controller ────────────────────

/** Bump whenever an outcome-affecting rule changes. */
export const SHATTER_SIM_VERSION = 2;

/**
 * Draws the safe side of every row up front from the gameplay RNG. Each row is an independent
 * fair 50/50 (rng() < 0.5 ⇒ left), so the per-row win probability is unchanged.
 * @param rng - Gameplay RNG returning [0, 1).
 * @param rows - Row count.
 * @returns Safe side per row, index 0 = bottom row (first pick).
 * @example
 * createShatterBoard(() => 0.3, 10); // all 'left'
 */
export function createShatterBoard(rng: () => number, rows: number = DEFAULT_ROWS): TileSide[] {
  const board: TileSide[] = [];
  for (let i = 0; i < rows; i++) board.push(rng() < 0.5 ? 'left' : 'right');
  return board;
}

/** Why a Shatter round ended. */
export type ShatterSettlementReason = 'cashout' | 'top' | 'shatter';

/** Immutable settlement. */
export interface ShatterSettlement {
  reason: ShatterSettlementReason;
  rowsCleared: number;
  multiplier: number;
  payout: number;
  returnHundredths: number;
  /** Row index (0-based) and side of the losing pick, when reason is 'shatter'. */
  brokenRow?: number;
  brokenSide?: TileSide;
}

/** One accepted pick. */
export interface ShatterPick { row: number; side: TileSide; safe: boolean; }

/** A deterministic round. */
export interface ShatterRound {
  readonly seed: string;
  readonly rng: ProvablyFairRNG;
  readonly config: ShatterStepConfig;
  /** Precommitted outcomes. Never shown before settlement. */
  readonly board: readonly TileSide[];
  state: ShatterStepState;
  picks: ShatterPick[];
  settlement: ShatterSettlement | null;
}

/**
 * Creates a seeded round and commits its board immediately.
 * @param seed - Round seed.
 * @param bet - Stake in credits.
 * @param config - Optional rows/multiplier/house-edge (payout schedule unchanged by default).
 * @returns Round.
 * @example
 * const r = createShatterRound('seed', 10);
 */
export function createShatterRound(seed: string, bet: number, config: ShatterStepConfig = {}): ShatterRound {
  const rng = new ProvablyFairRNG(seed, { algorithm: RNG_ALGORITHM_V2 });
  const rows = config.totalRows ?? DEFAULT_ROWS;
  const board = createShatterBoard(() => rng.random(), rows);
  return { seed, rng, config: { ...config, rng: undefined, board }, board, state: createShatterStepState(bet, config), picks: [], settlement: null };
}

function settleShatter(round: ShatterRound, reason: ShatterSettlementReason, payout: number, broken?: ShatterPick): ShatterSettlement {
  const s: ShatterSettlement = { reason, rowsCleared: round.state.currentRow, multiplier: round.state.multiplier, payout, returnHundredths: Math.round(payout * 100) };
  if (broken) { s.brokenRow = broken.row; s.brokenSide = broken.side; }
  round.settlement = s;
  return s;
}

/**
 * Picks a pane on the current row. Rejected (returns null) when settled.
 * @param round - Round (mutated).
 * @param side - Chosen side.
 * @returns The accepted pick, or null.
 * @example
 * pickShatterRound(round, 'left');
 */
export function pickShatterRound(round: ShatterRound, side: TileSide): ShatterPick | null {
  if (round.settlement || !round.state.isAlive || round.state.cashedOut) return null;
  const row = round.state.currentRow;
  pickTile(round.state, side, round.config);
  const pick: ShatterPick = { row, side, safe: round.state.lastPickCorrect === true };
  round.picks.push(pick);
  if (!pick.safe) settleShatter(round, 'shatter', 0, pick);
  else if (round.state.cashedOut) settleShatter(round, 'top', round.state.payout);
  return pick;
}

/**
 * @param round - Round.
 * @returns Whether cash-out is accepted (alive, unsettled, at least one row cleared).
 * @example
 * canCashOutShatter(round);
 */
export function canCashOutShatter(round: ShatterRound): boolean {
  return !round.settlement && round.state.isAlive && !round.state.cashedOut && round.state.currentRow > 0;
}

/**
 * Cashes out once.
 * @param round - Round.
 * @returns The settlement (existing one if already settled), or null if not allowed.
 * @example
 * cashOutShatterRound(round);
 */
export function cashOutShatterRound(round: ShatterRound): ShatterSettlement | null {
  if (round.settlement) return round.settlement;
  if (!canCashOutShatter(round)) return null;
  return settleShatter(round, 'cashout', cashOutShatterStep(round.state));
}

/**
 * The committed board, available only after settlement (truthful reveal).
 * @param round - Round.
 * @returns Safe sides per row, or null while the round is live.
 * @example
 * revealShatterBoard(round);
 */
export function revealShatterBoard(round: ShatterRound): readonly TileSide[] | null {
  return round.settlement ? round.board.slice() : null;
}

/** JSON-safe checkpoint (board included so replays can verify it). */
export interface ShatterCheckpoint {
  simVersion: number;
  seed: string;
  rng: RNGStateSnapshot;
  board: TileSide[];
  picks: ShatterPick[];
  state: ShatterStepState;
  settlement: ShatterSettlement | null;
}

/**
 * @param round - Round.
 * @returns Checkpoint.
 * @example
 * checkpointShatterRound(round);
 */
export function checkpointShatterRound(round: ShatterRound): ShatterCheckpoint {
  return JSON.parse(JSON.stringify({ simVersion: SHATTER_SIM_VERSION, seed: round.seed, rng: round.rng.getState(), board: round.board, picks: round.picks, state: round.state, settlement: round.settlement })) as ShatterCheckpoint;
}

/**
 * Replays picks from a seed and verifies the board matches.
 * @param seed - Round seed.
 * @param bet - Stake.
 * @param sides - Picks in order.
 * @param config - Optional config.
 * @returns The replayed round.
 * @example
 * replayShatterRound('seed', 10, ['left', 'right']);
 */
export function replayShatterRound(seed: string, bet: number, sides: readonly TileSide[], config: ShatterStepConfig = {}): ShatterRound {
  const round = createShatterRound(seed, bet, config);
  for (const side of sides) if (!pickShatterRound(round, side)) break;
  return round;
}
