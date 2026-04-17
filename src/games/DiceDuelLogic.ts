/**
 * @file DiceDuelLogic.ts
 * @purpose Pure game logic for Dice Duel — player vs house, 3 dice each,
 *          highest total wins 2×. Optional double-down before house reveals.
 *          No Phaser dependencies.
 * @author Agent 934
 * @date 2026-04-16
 * @license Proprietary – available for licensing
 */

import { ProvablyFairRNG } from '../shared/rng/ProvablyFairRNG';

// ─── Constants ────────────────────────────────────────────────────────────────
const DEFAULT_HOUSE_EDGE  = 0.04;
const DICE_COUNT          = 3;
const DICE_SIDES          = 6;
const WIN_MULTIPLIER      = 2;    // 2× on a normal win

// ─── Types ────────────────────────────────────────────────────────────────────

export type DuelOutcome = 'win' | 'lose' | 'push' | null;
export type DuelPhase   = 'bet' | 'player_rolled' | 'complete';

export interface DiceDuelState {
  bet:           number;
  playerDice:    number[];      // 3 values 1–6
  houseDice:     number[];      // 3 values 1–6
  playerTotal:   number;
  houseTotal:    number;
  doubledDown:   boolean;
  outcome:       DuelOutcome;
  payout:        number;        // net profit (can be negative on loss display, but stored as positive win or 0)
  phase:         DuelPhase;
  lastSeed:      string;
}

export interface DiceDuelConfig {
  rng?:       ProvablyFairRNG;
  houseEdge?: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rollDice(rng: ProvablyFairRNG): number[] {
  return Array.from({ length: DICE_COUNT }, () => rng.randomInt(1, DICE_SIDES));
}

function sum(dice: number[]): number {
  return dice.reduce((a, b) => a + b, 0);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Creates an initial Dice Duel game state.
 * @param bet - Wager in credits.
 * @returns Fresh DiceDuelState ready for a roll.
 * @example
 * const state = createDiceDuelState(10);
 */
export function createDiceDuelState(bet: number): DiceDuelState {
  return {
    bet,
    playerDice:  [0, 0, 0],
    houseDice:   [0, 0, 0],
    playerTotal: 0,
    houseTotal:  0,
    doubledDown: false,
    outcome:     null,
    payout:      0,
    phase:       'bet',
    lastSeed:    '',
  };
}

/**
 * Rolls the player's 3 dice. Does NOT roll house dice yet.
 * Sets phase to 'player_rolled'.
 * @param state  - Current game state.
 * @param config - Optional config with rng seed.
 * @returns Updated state (new object).
 * @example
 * state = rollPlayerDice(state, { rng: new ProvablyFairRNG('seed') });
 */
export function rollPlayerDice(state: DiceDuelState, config?: DiceDuelConfig): DiceDuelState {
  if (state.phase !== 'bet') return state;

  const rng = config?.rng ?? new ProvablyFairRNG();
  const playerDice  = rollDice(rng);
  const playerTotal = sum(playerDice);

  return {
    ...state,
    playerDice,
    playerTotal,
    phase:    'player_rolled',
    lastSeed: rng.getSeed(),
  };
}

/**
 * Doubles the bet. Only valid in 'player_rolled' phase.
 * @param state - Current game state.
 * @returns Updated state with doubled bet.
 * @example
 * state = doubleDown(state);
 */
export function doubleDown(state: DiceDuelState): DiceDuelState {
  if (state.phase !== 'player_rolled' || state.doubledDown) return state;
  return { ...state, bet: state.bet * 2, doubledDown: true };
}

/**
 * Rolls house dice and resolves the round.
 * House edge: small chance to flip player win to house win.
 * @param state  - Current state (must be 'player_rolled').
 * @param config - Optional config.
 * @returns Completed state.
 * @example
 * state = resolveRound(state);
 */
export function resolveRound(state: DiceDuelState, config?: DiceDuelConfig): DiceDuelState {
  if (state.phase !== 'player_rolled') return state;

  const rng       = config?.rng ?? new ProvablyFairRNG();
  const houseEdge = config?.houseEdge ?? DEFAULT_HOUSE_EDGE;
  const houseDice  = rollDice(rng);
  const houseTotal = sum(houseDice);

  let outcome: DuelOutcome;
  if (state.playerTotal > houseTotal) {
    // Apply house edge — small chance to flip win to lose
    outcome = rng.random() < houseEdge ? 'lose' : 'win';
  } else if (state.playerTotal === houseTotal) {
    outcome = 'push';
  } else {
    outcome = 'lose';
  }

  let payout = 0;
  if (outcome === 'win') {
    payout = state.bet * WIN_MULTIPLIER; // Returns bet + profit
  } else if (outcome === 'push') {
    payout = state.bet; // Return bet only
  }
  // lose: payout = 0

  return {
    ...state,
    houseDice,
    houseTotal,
    outcome,
    payout,
    phase: 'complete',
  };
}

/**
 * Simulates N rounds and returns estimated RTP.
 * @param rounds - Number of rounds.
 * @param bet    - Bet per round.
 * @param config - Optional config.
 * @returns RTP as fraction (e.g. 0.96 = 96%).
 * @example
 * const rtp = simulateDiceDuelRTP(5000, 10);
 */
export function simulateDiceDuelRTP(rounds: number, bet: number, config?: DiceDuelConfig): number {
  const rng = config?.rng ?? new ProvablyFairRNG('sim-seed');
  const cfg: DiceDuelConfig = { rng, houseEdge: config?.houseEdge ?? DEFAULT_HOUSE_EDGE };

  let totalBet = 0;
  let totalReturn = 0;

  for (let i = 0; i < rounds; i++) {
    totalBet += bet;
    let state = createDiceDuelState(bet);
    state = rollPlayerDice(state, cfg);
    state = resolveRound(state, cfg);
    totalReturn += state.payout;
  }

  return totalBet > 0 ? totalReturn / totalBet : 0;
}
