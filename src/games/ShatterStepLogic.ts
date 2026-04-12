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
}

const DEFAULT_ROWS = 10;
const DEFAULT_MULTIPLIER_PER_ROW = 1.5;
const DEFAULT_HOUSE_EDGE = 0.03;

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
  config: ShatterStepConfig = {}
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
  const rng = config.rng ?? Math.random;

  state.lastPick = pick;

  // 50/50 outcome
  const winningRoll = rng();
  const isCorrect = winningRoll >= 0.5;

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
  let totalBet = 0;
  let totalPayout = 0;
  const bet = 1;

  for (let i = 0; i < rounds; i++) {
    totalBet += bet;
    const state = createShatterStepState(bet, config);

    if (strategy === 'always-cashout') {
      pickTile(state, 'left', config);
      if (state.isAlive && !state.cashedOut && state.currentRow > 0) {
        cashOutShatterStep(state);
      }
    } else {
      while (state.isAlive && !state.cashedOut) {
        pickTile(state, 'left', config);
      }
    }

    totalPayout += state.payout;
  }

  return totalPayout / totalBet;
}
