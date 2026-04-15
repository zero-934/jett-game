/**
 * @file FruitFiestaLogic.ts
 * @purpose Pure game logic for Tropical Fruit Fiesta slot — symbol definitions, paylines,
 *          RNG reel stops, win evaluation, and payout calculation. Features a Wheel Bonus.
 * @author Agent 934
 * @date 2026-04-14
 * @license Proprietary – available for licensing
 */

import { getRandomSeedableRNG } from '../utils/RNG'; // Assuming a central RNG utility

/** Types of symbols on the reels for Tropical Fruit Fiesta. */
export type FruitFiestaSymbol =
  'CHERRY' | 'LEMON' | 'ORANGE' | 'PLUM' | 'GRAPE' | 'WATERMELON' |
  'A' | 'K' | 'Q' | 'J' | '10' |
  'WILD' | 'SCATTER' | 'BONUS_WHEEL';

/** Configuration for a Tropical Fruit Fiesta slot instance. */
export interface FruitFiestaConfig {
  houseEdge?: number; // 0.03 for 97% RTP
  rng?: () => number;
  overrideReelStops?: FruitFiestaSymbol[][]; // For deterministic testing
}

/** Possible outcomes for the Wheel Bonus. */
export type WheelBonusOutcome =
  'MINI_JACKPOT' | 'MIDI_JACKPOT' | 'MAJOR_JACKPOT' |
  'FREE_SPINS_5' | 'FREE_SPINS_10' | 'CASH_50x' | 'CASH_100x';

/** Full Tropical Fruit Fiesta slot game state. */
export interface FruitFiestaState {
  bet: number;
  linesBet: number; // Number of active paylines (e.g., 25)
  reelStops: FruitFiestaSymbol[][]; // Final symbols visible on reels (e.g., 5x3 grid)
  totalWin: number;
  isComplete: boolean;
  freeSpinsRemaining: number;
  wheelBonusTriggered: boolean; // Flag to indicate if wheel bonus should be presented
  wheelBonusOutcome: WheelBonusOutcome | null; // Result of the wheel spin
}

const DEFAULT_HOUSE_EDGE = 0.03; // 97% RTP
const REELS_COUNT        = 5;
const ROWS_COUNT         = 3;
const TOTAL_PAYLINES     = 25; // Example, will define actual payline patterns later

// All symbols, ordered by rough frequency (common to rare)
const SYMBOLS: FruitFiestaSymbol[] = [
  '10', 'J', 'Q', 'K', 'A',
  'PLUM', 'GRAPE', 'ORANGE',
  'LEMON', 'WATERMELON', 'CHERRY',
  'WILD', 'SCATTER', 'BONUS_WHEEL',
];

// Mapping symbols to their values for payouts (conceptual, will be refined)
const SYMBOL_PAYOUTS: { [key in FruitFiestaSymbol]: number } = {
  'CHERRY': 700,
  'WATERMELON': 600,
  'LEMON': 500,
  'ORANGE': 400,
  'GRAPE': 300,
  'PLUM': 200,
  'A': 100,
  'K': 75,
  'Q': 50,
  'J': 25,
  '10': 10,
  'WILD': 0, // Wild has no direct payout, only substitutes
  'SCATTER': 0, // Scatter has no direct payout, only triggers free spins
  'BONUS_WHEEL': 0, // Bonus Wheel has no direct payout, triggers bonus game
};

// Reel strip definitions (simplified for now)
const REEL_STRIPS: FruitFiestaSymbol[][] = [
  // Reel 1
  ['10', 'J', 'Q', 'K', 'A', 'PLUM', 'GRAPE', 'WILD', 'SCATTER', 'BONUS_WHEEL', '10', 'J', 'Q', 'K', 'A', 'CHERRY', 'WATERMELON'],
  // Reel 2
  ['J', 'Q', 'K', 'A', 'PLUM', 'GRAPE', 'ORANGE', 'WILD', '10', 'J', 'Q', 'K', 'A', 'CHERRY', 'SCATTER', 'BONUS_WHEEL'],
  // Reel 3
  ['Q', 'K', 'A', 'PLUM', 'GRAPE', 'LEMON', 'WILD', 'SCATTER', 'BONUS_WHEEL', '10', 'J', 'Q', 'K', 'A', 'ORANGE', 'CHERRY'],
  // Reel 4
  ['K', 'A', 'PLUM', 'GRAPE', 'ORANGE', 'LEMON', 'WILD', '10', 'J', 'Q', 'K', 'A', 'CHERRY', 'SCATTER', 'BONUS_WHEEL'],
  // Reel 5
  ['A', 'PLUM', 'GRAPE', 'LEMON', 'CHERRY', 'WILD', 'SCATTER', 'BONUS_WHEEL', '10', 'J', 'Q', 'K', 'A', 'ORANGE'],
];

// Payline definitions (same as previous for consistency)
const PAYLINES: [number, number][][] = [
  [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]], [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1]], [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2]],
  [[0, 0], [1, 1], [2, 2], [3, 1], [4, 0]], [[0, 2], [1, 1], [2, 0], [3, 1], [4, 2]],
  [[0, 0], [1, 0], [2, 1], [3, 0], [4, 0]], [[0, 2], [1, 2], [2, 1], [3, 2], [4, 2]],
  [[0, 1], [1, 0], [2, 0], [3, 0], [4, 1]], [[0, 1], [1, 2], [2, 2], [3, 2], [4, 1]],
  [[0, 0], [1, 1], [2, 0], [3, 1], [4, 0]], [[0, 2], [1, 1], [2, 2], [3, 1], [4, 2]],
  [[0, 0], [1, 0], [2, 0], [3, 1], [4, 1]], [[0, 0], [1, 1], [2, 1], [3, 1], [4, 0]],
  [[0, 1], [1, 0], [2, 1], [3, 2], [4, 1]], [[0, 1], [1, 2], [2, 1], [3, 0], [4, 1]],
  [[0, 0], [1, 1], [2, 2], [3, 2], [4, 2]], [[0, 2], [1, 1], [2, 0], [3, 0], [4, 0]],
  [[0, 0], [1, 0], [2, 1], [3, 2], [4, 2]], [[0, 2], [1, 2], [2, 1], [3, 0], [4, 0]],
  [[0, 1], [1, 1], [2, 0], [3, 1], [4, 1]], [[0, 1], [1, 1], [2, 2], [3, 1], [4, 1]],
  [[0, 0], [1, 1], [2, 1], [3, 0], [4, 0]], [[0, 2], [1, 1], [2, 1], [3, 2], [4, 2]],
  [[0, 0], [1, 0], [2, 0], [3, 0], [4, 1]], [[0, 2], [1, 2], [2, 2], [3, 2], [4, 1]],
];

// Wheel bonus outcomes and their probabilities (simplified for Logic.ts)
const WHEEL_OUTCOMES: { outcome: WheelBonusOutcome, weight: number, valueMultiplier?: number, freeSpins?: number }[] = [
  { outcome: 'CASH_50x', weight: 40, valueMultiplier: 50 },
  { outcome: 'CASH_100x', weight: 25, valueMultiplier: 100 },
  { outcome: 'FREE_SPINS_5', weight: 20, freeSpins: 5 },
  { outcome: 'FREE_SPINS_10', weight: 10, freeSpins: 10 },
  { outcome: 'MINI_JACKPOT', weight: 4, valueMultiplier: 200 }, // Example fixed jackpot
  { outcome: 'MIDI_JACKPOT', weight: 1, valueMultiplier: 500 }, // Example fixed jackpot
];

const WHEEL_OUTCOMES_TOTAL_WEIGHT = WHEEL_OUTCOMES.reduce((sum, o) => sum + o.weight, 0);

/**
 * Creates an initial Tropical Fruit Fiesta slot game state.
 *
 * @param bet - Wager in credits per line.
 * @param linesBet - Number of active paylines.
 * @returns Fresh FruitFiestaState.
 */
export function createFruitFiestaState(bet: number, linesBet: number): FruitFiestaState {
  return {
    bet,
    linesBet: Math.min(linesBet, TOTAL_PAYLINES),
    reelStops: Array(REELS_COUNT).fill(null).map(() => Array(ROWS_COUNT).fill('10')), // Default to low symbol
    totalWin: 0,
    isComplete: false,
    freeSpinsRemaining: 0,
    wheelBonusTriggered: false,
    wheelBonusOutcome: null,
  };
}

/**
 * Executes a single spin and determines wins for Tropical Fruit Fiesta.
 *
 * @param state - Current game state (mutated).
 * @param config - Game configuration.
 * @returns Updated state with spin result.
 */
export function spinFruitFiesta(state: FruitFiestaState, config: FruitFiestaConfig = {}): FruitFiestaState {
  // Reset bonus flags for the new spin
  state.wheelBonusTriggered = false;
  state.wheelBonusOutcome   = null;

  if (state.isComplete && state.freeSpinsRemaining <= 0) return state; // Only allow spin if not complete or in free spins

  const houseEdge = config.houseEdge ?? DEFAULT_HOUSE_EDGE;
  const rng       = config.rng       ?? Math.random;

  // Determine final stop positions for each reel, or use override for testing
  state.reelStops = config.overrideReelStops ?? REEL_STRIPS.map(strip => {
    const stopPosition = Math.floor(rng() * strip.length);
    return Array(ROWS_COUNT).fill(null).map((_, i) => {
      // Wrap around strip if index goes out of bounds
      const symbolIndex = (stopPosition + i) % strip.length;
      return strip[symbolIndex];
    });
  });

  // Evaluate wins
  state.totalWin = 0;
  let scattersHit = 0;
  let bonusWheelsHit = 0;
  const currentSymbolsOnGrid: FruitFiestaSymbol[][] = state.reelStops;

  // Count scatters and bonus wheel symbols
  currentSymbolsOnGrid.forEach(reel => {
    reel.forEach(symbol => {
      if (symbol === 'SCATTER') {
        scattersHit++;
      } else if (symbol === 'BONUS_WHEEL') {
        bonusWheelsHit++;
      }
    });
  });

  // Trigger free spins (e.g., 3+ scatters for 10 free spins)
  if (scattersHit >= 3) {
    state.freeSpinsRemaining += 10; // Tropical Fruit Fiesta awards 10 free spins
  }

  // Trigger Wheel Bonus
  if (bonusWheelsHit >= 3) {
    state.wheelBonusTriggered = true;
    // Simulate wheel spin outcome for Logic.ts
    const rand = rng() * WHEEL_OUTCOMES_TOTAL_WEIGHT;
    let cumulativeWeight = 0;
    for (const outcomeDef of WHEEL_OUTCOMES) {
      cumulativeWeight += outcomeDef.weight;
      if (rand <= cumulativeWeight) {
        state.wheelBonusOutcome = outcomeDef.outcome;
        if (outcomeDef.valueMultiplier) {
          state.totalWin += state.bet * state.linesBet * outcomeDef.valueMultiplier;
        } else if (outcomeDef.freeSpins) {
          state.freeSpinsRemaining += outcomeDef.freeSpins;
        }
        break;
      }
    }
  }

  // Evaluate paylines
  for (let i = 0; i < state.linesBet; i++) {
    const payline = PAYLINES[i];
    if (!payline) continue;

    let lineSymbols: FruitFiestaSymbol[] = [];
    for (const [reelIdx, rowIdx] of payline) {
      if (currentSymbolsOnGrid[reelIdx] && currentSymbolsOnGrid[reelIdx][rowIdx]) {
        lineSymbols.push(currentSymbolsOnGrid[reelIdx][rowIdx]);
      } else {
        lineSymbols.push('10');
      }
    }

    const winAmount = evaluateFruitFiestaPayline(lineSymbols);
    state.totalWin += winAmount;
  }

  // Apply house edge
  state.totalWin = parseFloat((state.totalWin * (1 - houseEdge)).toFixed(2));

  // Handle free spins logic
  if (state.freeSpinsRemaining > 0) {
    state.freeSpinsRemaining--;
    state.isComplete = (state.freeSpinsRemaining === 0);
  } else {
    state.isComplete = true;
  }

  return state;
}

/**
 * Evaluates a single payline for a win and returns the payout for Tropical Fruit Fiesta.
 *
 * @param lineSymbols - Array of symbols on the payline.
 * @returns Payout amount for this line.
 */
function evaluateFruitFiestaPayline(lineSymbols: FruitFiestaSymbol[]): number {
  if (lineSymbols.length !== REELS_COUNT) return 0;

  let primarySymbol: FruitFiestaSymbol | null = null;
  for (const symbol of lineSymbols) {
    if (symbol !== 'WILD') {
      primarySymbol = symbol;
      break;
    }
  }

  if (!primarySymbol) {
    // All wilds, evaluate as highest paying symbol (CHERRY)
    primarySymbol = 'CHERRY';
  }

  let count = 0;
  for (let i = 0; i < lineSymbols.length; i++) {
    if (lineSymbols[i] === primarySymbol || lineSymbols[i] === 'WILD') {
      count++;
    } else {
      break;
    }
  }

  if (count >= 3) {
    const basePayout = SYMBOL_PAYOUTS[primarySymbol] || 0;
    switch (count) {
      case 3: return basePayout * 0.1;
      case 4: return basePayout * 0.5;
      case 5: return basePayout * 1.0;
      default: return 0;
    }
  }
  return 0;
}


/**
 * Simulates many rounds to estimate RTP for Tropical Fruit Fiesta.
 *
 * @param rounds - Number of rounds to simulate.
 * @param betPerLine - Bet amount per line.
 * @param linesBet - Number of active paylines.
 * @param config - Game config (including houseEdge).
 * @returns Estimated RTP as a fraction (0-1).
 */
export function simulateFruitFiestaRTP(
  rounds: number,
  betPerLine: number,
  linesBet: number,
  config: FruitFiestaConfig = {}
): number {
  let totalBet    = 0;
  let totalPayout = 0;
  for (let i = 0; i < rounds; i++) {
    const state = createFruitFiestaState(betPerLine, linesBet);
    spinFruitFiesta(state, config);
    totalBet    += (betPerLine * linesBet);
    totalPayout += state.totalWin;
  }
  return totalPayout / totalBet;
}
