/**
 * @file DiceLogic.ts
 * @purpose Pure game logic for Dice — multiplier tier selection, RNG roll,
 *          win/loss determination with house edge baked in. No Phaser dependencies.
 * @author Agent 934
 * @date 2026-04-13
 * @license Proprietary – available for licensing
 */

/** Available multiplier tiers. */
export type DiceTier = 2 | 5 | 10;

/** Full Dice game state. */
export interface DiceState {
  bet: number;
  selectedTier: DiceTier;
  roll: number | null;       // last RNG roll (0–1)
  diceValues: number[];      // visual dice face values [1–6, 1–6, 1–6]
  won: boolean | null;       // null = not yet rolled
  payout: number;
  isComplete: boolean;
}

/** Configuration for a Dice game instance. */
export interface DiceConfig {
  houseEdge?: number;
  rng?: () => number;
}

const DEFAULT_HOUSE_EDGE = 0.03;

/**
 * Returns the win probability for a given tier after house edge is applied.
 * Fair probability = 1/multiplier. House edge reduces it slightly.
 *
 * @param tier - The chosen multiplier (2, 5, or 10).
 * @param houseEdge - Fraction taken by house (default 0.03).
 * @returns Win probability as a fraction (0–1).
 *
 * @example
 * getWinProbability(2, 0.03); // 0.485
 */
export function getWinProbability(tier: DiceTier, houseEdge: number = DEFAULT_HOUSE_EDGE): number {
  const fairChance = 1 / tier;
  return parseFloat((fairChance * (1 - houseEdge)).toFixed(4));
}

/**
 * Creates an initial Dice game state.
 *
 * @param bet - Wager in credits.
 * @param tier - Starting multiplier tier.
 * @returns Fresh DiceState.
 *
 * @example
 * const state = createDiceState(10, 2);
 */
export function createDiceState(bet: number, tier: DiceTier = 2): DiceState {
  return {
    bet,
    selectedTier: tier,
    roll: null,
    diceValues: [1, 1, 1],
    won: null,
    payout: 0,
    isComplete: false,
  };
}

/**
 * Changes the selected multiplier tier before rolling.
 *
 * @param state - Current game state (mutated).
 * @param tier - New tier selection.
 * @returns Updated state.
 *
 * @example
 * selectTier(state, 5);
 */
export function selectTier(state: DiceState, tier: DiceTier): DiceState {
  if (state.isComplete || state.won !== null) return state;
  state.selectedTier = tier;
  return state;
}

/**
 * Executes a dice roll and determines win/loss.
 *
 * @param state - Current game state (mutated).
 * @param config - Game configuration.
 * @returns Updated state with roll result.
 *
 * @example
 * rollDice(state, { houseEdge: 0.03 });
 */
export function rollDice(state: DiceState, config: DiceConfig = {}): DiceState {
  if (state.isComplete || state.won !== null) return state;

  const houseEdge = config.houseEdge ?? DEFAULT_HOUSE_EDGE;
  const rng       = config.rng       ?? Math.random;

  // Generate 3 dice faces for visual
  state.diceValues = [
    Math.floor(rng() * 6) + 1,
    Math.floor(rng() * 6) + 1,
    Math.floor(rng() * 6) + 1,
  ];

  // Outcome roll
  state.roll = rng();
  const winProb = getWinProbability(state.selectedTier, houseEdge);

  state.won = state.roll < winProb;
  state.payout = state.won
    ? parseFloat((state.bet * state.selectedTier).toFixed(2))
    : 0;
  state.isComplete = true;

  return state;
}

/**
 * Simulates many rounds to estimate RTP.
 *
 * @param rounds - Number of rounds to simulate.
 * @param tier - Multiplier tier to use.
 * @param config - Game config.
 * @returns Estimated RTP as a fraction.
 *
 * @example
 * simulateDiceRTP(10000, 2, {}); // ~0.97
 */
export function simulateDiceRTP(rounds: number, tier: DiceTier, config: DiceConfig = {}): number {
  let totalBet = 0;
  let totalPayout = 0;
  for (let i = 0; i < rounds; i++) {
    const state = createDiceState(1, tier);
    rollDice(state, config);
    totalBet    += 1;
    totalPayout += state.payout;
  }
  return totalPayout / totalBet;
}
