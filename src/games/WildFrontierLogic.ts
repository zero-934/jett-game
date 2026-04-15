/**
 * @file WildFrontierLogic.ts
 * @purpose Pure game logic for Wild Frontier slot — symbol definitions, paylines,
 *          RNG reel stops, win evaluation, and payout calculation. No Phaser.
 * @author C-3PO
 * @date 2026-04-14
 * @license Proprietary – available for licensing
 */

import { getRandomSeedableRNG } from '../utils/RNG'; // Assuming a central RNG utility

/** Types of symbols on the reels. */
export type WildFrontierSymbol =
  'COWBOY' | 'INDIGENOUS_GUIDE' | 'HORSE' | 'BUFFALO' | 'GOLD_NUGGET' |
  'A' | 'K' | 'Q' | 'J' | '10' |
  'WILD' | 'SCATTER';

/** Configuration for a Wild Frontier slot instance. */
export interface WildFrontierConfig {
  houseEdge?: number; // 0.04 for 96% RTP
  rng?: () => number;
}

/** Full Wild Frontier slot game state. */
export interface WildFrontierState {
  bet: number;
  linesBet: number; // Number of active paylines (e.g., 25)
  reelStops: WildFrontierSymbol[][]; // Final symbols visible on reels (e.g., 5x3 grid)
  totalWin: number;
  isComplete: boolean;
  freeSpinsRemaining: number;
}

const DEFAULT_HOUSE_EDGE = 0.04; // 96% RTP
const REELS_COUNT        = 5;
const ROWS_COUNT         = 3;
const TOTAL_PAYLINES     = 25; // Example, will define actual payline patterns later

// All symbols, ordered by rough frequency (common to rare)
const SYMBOLS: WildFrontierSymbol[] = [
  '10', 'J', 'Q', 'K', 'A',
  'GOLD_NUGGET', 'BUFFALO', 'HORSE',
  'INDIGENOUS_GUIDE', 'COWBOY',
  'WILD', 'SCATTER',
];

// Mapping symbols to their values for payouts (conceptual, will be refined)
const SYMBOL_PAYOUTS: { [key in WildFrontierSymbol]: number } = {
  'COWBOY': 500,
  'INDIGENOUS_GUIDE': 400,
  'HORSE': 300,
  'BUFFALO': 200,
  'GOLD_NUGGET': 150,
  'A': 100,
  'K': 75,
  'Q': 50,
  'J': 25,
  '10': 10,
  'WILD': 0, // Wild has no direct payout, only substitutes
  'SCATTER': 0, // Scatter has no direct payout, only triggers free spins
};

// Reel strip definitions (simplified for now, will be more complex for actual RTP)
// Each array represents a reel, with symbols appearing in sequence.
// Real slots use much longer strips and weighting.
const REEL_STRIPS: WildFrontierSymbol[][] = [
  // Reel 1 (Leftmost)
  ['10', 'J', 'Q', 'K', 'A', 'GOLD_NUGGET', 'BUFFALO', 'HORSE', 'WILD', 'SCATTER', '10', 'J', 'Q', 'K', 'A', 'COWBOY', 'INDIGENOUS_GUIDE'],
  // Reel 2
  ['J', 'Q', 'K', 'A', 'GOLD_NUGGET', 'BUFFALO', 'HORSE', 'INDIGENOUS_GUIDE', 'WILD', '10', 'J', 'Q', 'K', 'A', 'COWBOY', 'SCATTER'],
  // Reel 3 (Center)
  ['Q', 'K', 'A', 'GOLD_NUGGET', 'BUFFALO', 'HORSE', 'COWBOY', 'WILD', 'SCATTER', '10', 'J', 'Q', 'K', 'A', 'INDIGENOUS_GUIDE'],
  // Reel 4
  ['K', 'A', 'GOLD_NUGGET', 'BUFFALO', 'HORSE', 'INDIGENOUS_GUIDE', 'WILD', '10', 'J', 'Q', 'K', 'A', 'COWBOY', 'SCATTER'],
  // Reel 5 (Rightmost)
  ['A', 'GOLD_NUGGET', 'BUFFALO', 'HORSE', 'COWBOY', 'WILD', 'SCATTER', '10', 'J', 'Q', 'K', 'A', 'INDIGENOUS_GUIDE'],
];

// Definition of 25 paylines for a 5x3 grid
// Each payline is an array of [reelIndex, rowIndex] coordinates
const PAYLINES: [number, number][][] = [
  // Horizontal lines
  [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]], // Top Row
  [[0, 1], [1, 1], [2, 1], [3, 1], [4, 1]], // Middle Row
  [[0, 2], [1, 2], [2, 2], [3, 2], [4, 2]], // Bottom Row

  // Diagonal lines
  [[0, 0], [1, 1], [2, 2], [3, 1], [4, 0]],
  [[0, 2], [1, 1], [2, 0], [3, 1], [4, 2]],

  // V-shapes
  [[0, 0], [1, 0], [2, 1], [3, 0], [4, 0]],
  [[0, 2], [1, 2], [2, 1], [3, 2], [4, 2]],

  // Inverted V-shapes
  [[0, 1], [1, 0], [2, 0], [3, 0], [4, 1]],
  [[0, 1], [1, 2], [2, 2], [3, 2], [4, 1]],

  // Zig-zags
  [[0, 0], [1, 1], [2, 0], [3, 1], [4, 0]],
  [[0, 2], [1, 1], [2, 2], [3, 1], [4, 2]],

  // More complex patterns to reach 25 (example patterns, will need refining)
  [[0, 0], [1, 0], [2, 0], [3, 1], [4, 1]],
  [[0, 0], [1, 1], [2, 1], [3, 1], [4, 0]],
  [[0, 1], [1, 0], [2, 1], [3, 2], [4, 1]],
  [[0, 1], [1, 2], [2, 1], [3, 0], [4, 1]],
  [[0, 0], [1, 1], [2, 2], [3, 2], [4, 2]],
  [[0, 2], [1, 1], [2, 0], [3, 0], [4, 0]],
  [[0, 0], [1, 0], [2, 1], [3, 2], [4, 2]],
  [[0, 2], [1, 2], [2, 1], [3, 0], [4, 0]],
  [[0, 1], [1, 1], [2, 0], [3, 1], [4, 1]],
  [[0, 1], [1, 1], [2, 2], [3, 1], [4, 1]],
  [[0, 0], [1, 1], [2, 1], [3, 0], [4, 0]],
  [[0, 2], [1, 1], [2, 1], [3, 2], [4, 2]],
  [[0, 0], [1, 0], [2, 0], [3, 0], [4, 1]],
  [[0, 2], [1, 2], [2, 2], [3, 2], [4, 1]],
];


/**
 * Creates an initial Wild Frontier slot game state.
 *
 * @param bet - Wager in credits per line.
 * @param linesBet - Number of active paylines.
 * @returns Fresh WildFrontierState.
 *
 * @example
 * const state = createWildFrontierState(1, 25);
 */
export function createWildFrontierState(bet: number, linesBet: number): WildFrontierState {
  return {
    bet,
    linesBet: Math.min(linesBet, TOTAL_PAYLINES),
    reelStops: Array(REELS_COUNT).fill(null).map(() => Array(ROWS_COUNT).fill('10')), // Default to low symbol
    totalWin: 0,
    isComplete: false,
    freeSpinsRemaining: 0,
  };
}

/**
 * Executes a single spin and determines wins.
 *
 * @param state - Current game state (mutated).
 * @param config - Game configuration.
 * @returns Updated state with spin result.
 *
 * @example
 * spinWildFrontier(state, { houseEdge: 0.04 });
 */
export function spinWildFrontier(state: WildFrontierState, config: WildFrontierConfig = {}): WildFrontierState {
  if (state.isComplete && state.freeSpinsRemaining <= 0) return state; // Only allow spin if not complete or in free spins

  const houseEdge = config.houseEdge ?? DEFAULT_HOUSE_EDGE;
  const rng       = config.rng       ?? Math.random;

  // Determine final stop positions for each reel
  state.reelStops = REEL_STRIPS.map(strip => {
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
  const currentSymbolsOnGrid: WildFrontierSymbol[][] = state.reelStops;

  // Count scatters
  currentSymbolsOnGrid.forEach(reel => {
    reel.forEach(symbol => {
      if (symbol === 'SCATTER') {
        scattersHit++;
      }
    });
  });

  // Trigger free spins
  if (scattersHit >= 3) { // Typically 3+ scatters for free spins
    state.freeSpinsRemaining += 10; // Example: 10 free spins
    // Scatter payout could also be added here if desired
  }

  // Evaluate paylines
  for (let i = 0; i < state.linesBet; i++) {
    const payline = PAYLINES[i];
    if (!payline) continue; // Should not happen if linesBet is capped

    let lineSymbols: WildFrontierSymbol[] = [];
    for (const [reelIdx, rowIdx] of payline) {
      if (currentSymbolsOnGrid[reelIdx] && currentSymbolsOnGrid[reelIdx][rowIdx]) {
        lineSymbols.push(currentSymbolsOnGrid[reelIdx][rowIdx]);
      } else {
        // Handle cases where a symbol might be missing (shouldn't happen with 5x3)
        lineSymbols.push('10'); // Default to a low value symbol
      }
    }

    // Evaluate the line for a win
    const winAmount = evaluatePayline(lineSymbols); // Will need houseEdge passed in to evaluate
    state.totalWin += winAmount; // This part needs refinement with houseEdge
  }

  // Apply house edge to the total win for this spin.
  // This is a simplified application for RTP calculation in simulation.
  // Real slots apply house edge through symbol probabilities and payout table design.
  // For now, we simulate this by reducing the final payout slightly for the spin.
  // This will be refined as the symbol distribution and paytable are balanced for 96% RTP.
  state.totalWin = parseFloat((state.totalWin * (1 - houseEdge)).toFixed(2));

  // Handle free spins logic
  if (state.freeSpinsRemaining > 0) {
    state.freeSpinsRemaining--;
    // If it was a free spin, it's not "complete" yet if more spins remain
    state.isComplete = (state.freeSpinsRemaining === 0);
  } else {
    state.isComplete = true;
  }

  return state;
}

/**
 * Evaluates a single payline for a win and returns the payout.
 * This function will be the core of RTP balancing.
 *
 * @param lineSymbols - Array of symbols on the payline.
 * @returns Payout amount for this line.
 */
function evaluatePayline(lineSymbols: WildFrontierSymbol[]): number {
  if (lineSymbols.length !== REELS_COUNT) return 0; // Must be a full line

  // Determine the primary symbol for evaluation (first non-wild)
  let primarySymbol: WildFrontierSymbol | null = null;
  for (const symbol of lineSymbols) {
    if (symbol !== 'WILD') {
      primarySymbol = symbol;
      break;
    }
  }

  if (!primarySymbol) {
    // All wilds on the line, evaluate as highest paying symbol (COWBOY)
    primarySymbol = 'COWBOY';
  }

  let count = 0;
  for (let i = 0; i < lineSymbols.length; i++) {
    if (lineSymbols[i] === primarySymbol || lineSymbols[i] === 'WILD') {
      count++;
    } else {
      break; // Streak broken
    }
  }

  // Payout based on count and primary symbol (simplified example)
  if (count >= 3) { // Minimum 3 symbols for a win
    const basePayout = SYMBOL_PAYOUTS[primarySymbol] || 0;
    // This is a highly simplified payout calculation.
    // Real slots use a complex paytable for each symbol combo (3-of-a-kind, 4-of-a-kind, 5-of-a-kind).
    // This will need extensive refinement and balancing for the target RTP.
    switch (count) {
      case 3: return basePayout * 0.1; // Example: small payout for 3
      case 4: return basePayout * 0.5; // Example: medium payout for 4
      case 5: return basePayout * 1.0; // Example: full payout for 5
      default: return 0;
    }
  }
  return 0;
}


/**
 * Simulates many rounds to estimate RTP for a specific bet.
 * This is crucial for balancing the game to 96% RTP.
 *
 * @param rounds - Number of rounds to simulate.
 * @param betPerLine - Bet amount per line.
 * @param linesBet - Number of active paylines.
 * @param config - Game config (including houseEdge).
 * @returns Estimated RTP as a fraction (0-1).
 */
export function simulateWildFrontierRTP(
  rounds: number,
  betPerLine: number,
  linesBet: number,
  config: WildFrontierConfig = {}
): number {
  let totalBet    = 0;
  let totalPayout = 0;
  for (let i = 0; i < rounds; i++) {
    const state = createWildFrontierState(betPerLine, linesBet);
    spinWildFrontier(state, config); // Spin once
    totalBet    += (betPerLine * linesBet);
    totalPayout += state.totalWin;
  }
  return totalPayout / totalBet;
}
