/**
 * @file LuckySevensLogic.ts
 * @purpose Pure game logic for Lucky Sevens Classic slot — symbol definitions, paylines,
 *          RNG reel stops, win evaluation, and payout calculation. A classic 3-reel slot.
 * @author Agent 934
 * @date 2026-04-14
 * @license Proprietary – available for licensing
 */

import { getRandomSeedableRNG } from '../utils/RNG'; // Assuming a central RNG utility

/** Types of symbols on the reels for Lucky Sevens Classic. */
export type LuckySevensSymbol =
  'RED_SEVEN' | 'BLUE_SEVEN' | 'TRIPLE_BAR' | 'DOUBLE_BAR' | 'SINGLE_BAR' |
  'CHERRY' | 'WILD';

/** Configuration for a Lucky Sevens Classic slot instance. */
export interface LuckySevensConfig {
  houseEdge?: number; // 0.03 for 97% RTP
  rng?: () => number;
  overrideReelStops?: LuckySevensSymbol[][]; // For deterministic testing
}

/** Full Lucky Sevens Classic slot game state. */
export interface LuckySevensState {
  bet: number;
  linesBet: number; // Number of active paylines (e.g., 1, 3, or 5)
  reelStops: LuckySevensSymbol[][]; // Final symbols visible on reels (3x3 grid)
  totalWin: number;
  isComplete: boolean;
}

const DEFAULT_HOUSE_EDGE = 0.03; // 97% RTP
const REELS_COUNT        = 3;
const ROWS_COUNT         = 3;
const TOTAL_PAYLINES     = 5; // Typically 1, 3, or 5 for classic slots

// All symbols, ordered by rough frequency (common to rare)
const SYMBOLS: LuckySevensSymbol[] = [
  'SINGLE_BAR', 'DOUBLE_BAR', 'TRIPLE_BAR',
  'CHERRY', 'BLUE_SEVEN', 'RED_SEVEN',
  'WILD',
];

// Mapping symbols to their values for payouts (conceptual, will be refined)
const SYMBOL_PAYOUTS: { [key in LuckySevensSymbol]: number } = {
  'RED_SEVEN': 1000,
  'BLUE_SEVEN': 500,
  'TRIPLE_BAR': 200,
  'DOUBLE_BAR': 100,
  'SINGLE_BAR': 50,
  'CHERRY': 20,
  'WILD': 0, // Wild has no direct payout, only substitutes
};

// Reel strip definitions (simplified for now)
const REEL_STRIPS: LuckySevensSymbol[][] = [
  // Reel 1
  ['CHERRY', 'SINGLE_BAR', 'DOUBLE_BAR', 'RED_SEVEN', 'TRIPLE_BAR', 'WILD', 'SINGLE_BAR', 'BLUE_SEVEN', 'CHERRY'],
  // Reel 2
  ['SINGLE_BAR', 'DOUBLE_BAR', 'CHERRY', 'BLUE_SEVEN', 'TRIPLE_BAR', 'WILD', 'RED_SEVEN', 'SINGLE_BAR', 'DOUBLE_BAR'],
  // Reel 3
  ['DOUBLE_BAR', 'CHERRY', 'SINGLE_BAR', 'TRIPLE_BAR', 'RED_SEVEN', 'BLUE_SEVEN', 'WILD', 'CHERRY', 'SINGLE_BAR'],
];

// Definition of 5 paylines for a 3x3 grid
const PAYLINES: [number, number][][] = [
  [[0, 0], [1, 0], [2, 0]], // Top Row
  [[0, 1], [1, 1], [2, 1]], // Middle Row
  [[0, 2], [1, 2], [2, 2]], // Bottom Row
  [[0, 0], [1, 1], [2, 2]], // Diagonal top-left to bottom-right
  [[0, 2], [1, 1], [2, 0]], // Diagonal bottom-left to top-right
];

/**
 * Creates an initial Lucky Sevens Classic slot game state.
 *
 * @param bet - Wager in credits per line.
 * @param linesBet - Number of active paylines (1, 3, or 5).
 * @returns Fresh LuckySevensState.
 */
export function createLuckySevensState(bet: number, linesBet: number): LuckySevensState {
  return {
    bet,
    linesBet: Math.min(linesBet, TOTAL_PAYLINES),
    reelStops: Array(REELS_COUNT).fill(null).map(() => Array(ROWS_COUNT).fill('SINGLE_BAR')), // Default
    totalWin: 0,
    isComplete: false,
  };
}

/**
 * Executes a single spin and determines wins for Lucky Sevens Classic.
 *
 * @param state - Current game state (mutated).
 * @param config - Game configuration.
 * @returns Updated state with spin result.
 */
export function spinLuckySevens(state: LuckySevensState, config: LuckySevensConfig = {}): LuckySevensState {
  if (state.isComplete) return state; // Only allow spin if not complete

  const houseEdge = config.houseEdge ?? DEFAULT_HOUSE_EDGE;
  const rng       = config.rng       ?? Math.random;

  // Determine final stop positions for each reel, or use override for testing
  state.reelStops = config.overrideReelStops ?? REEL_STRIPS.map(strip => {
    const stopPosition = Math.floor(rng() * strip.length);
    return Array(ROWS_COUNT).fill(null).map((_, i) => {
      const symbolIndex = (stopPosition + i) % strip.length;
      return strip[symbolIndex];
    });
  });

  // Evaluate wins
  state.totalWin = 0;
  const currentSymbolsOnGrid: LuckySevensSymbol[][] = state.reelStops;

  // Evaluate paylines
  for (let i = 0; i < state.linesBet; i++) {
    const payline = PAYLINES[i];
    if (!payline) continue;

    let lineSymbols: LuckySevensSymbol[] = [];
    for (const [reelIdx, rowIdx] of payline) {
      if (currentSymbolsOnGrid[reelIdx] && currentSymbolsOnGrid[reelIdx][rowIdx]) {
        lineSymbols.push(currentSymbolsOnGrid[reelIdx][rowIdx]);
      } else {
        lineSymbols.push('SINGLE_BAR'); // Default to a low value symbol
      }
    }

    const winAmount = evaluateLuckySevensPayline(lineSymbols);
    state.totalWin += winAmount;
  }

  // Apply house edge
  state.totalWin = parseFloat((state.totalWin * (1 - houseEdge)).toFixed(2));

  state.isComplete = true;

  return state;
}

/**
 * Evaluates a single payline for a win and returns the payout for Lucky Sevens Classic.
 *
 * @param lineSymbols - Array of symbols on the payline.
 * @returns Payout amount for this line.
 */
function evaluateLuckySevensPayline(lineSymbols: LuckySevensSymbol[]): number {
  if (lineSymbols.length !== REELS_COUNT) return 0; // Must be 3 symbols

  const isBar = (s: LuckySevensSymbol) => ['SINGLE_BAR', 'DOUBLE_BAR', 'TRIPLE_BAR'].includes(s);

  // --- 1. Check for 3 WILDs (Highest Priority) ---
  if (lineSymbols.every(s => s === 'WILD')) {
    return SYMBOL_PAYOUTS['RED_SEVEN'] * 2;
  }

  // --- 2. Check for 3 Matching Symbols (with Wilds as substitutes) ---
  let primarySymbol: LuckySevensSymbol | null = null;
  for (const symbol of lineSymbols) {
    if (symbol !== 'WILD') { // Ignore wilds for establishing the primary symbol
      primarySymbol = symbol;
      break;
    }
  }

  if (primarySymbol) {
    let matchesWithWilds = 0;
    for (const symbol of lineSymbols) {
      if (symbol === primarySymbol || symbol === 'WILD') {
        matchesWithWilds++;
      }
    }
    if (matchesWithWilds === REELS_COUNT) { // All 3 symbols match the primary or are wild
      return SYMBOL_PAYOUTS[primarySymbol] || 0;
    }
  }

  // --- 3. Check for Mixed BARs (All symbols must be BARs or WILDs acting as BARs) ---
  const allSymbolsAreBarsOrWilds = lineSymbols.every(s => isBar(s) || s === 'WILD');
  if (allSymbolsAreBarsOrWilds) {
      return SYMBOL_PAYOUTS['SINGLE_BAR'] / 2;
  }

  // --- 4. Check for Cherry Combinations (Lowest Priority "Scatter-like" Payouts) ---
  const cherryCount = lineSymbols.filter(s => s === 'CHERRY').length;
  if (cherryCount === 3) return SYMBOL_PAYOUTS['CHERRY'] * 2;
  if (cherryCount === 2) return SYMBOL_PAYOUTS['CHERRY'] / 2;
  if (cherryCount === 1) return SYMBOL_PAYOUTS['CHERRY'] / 4;

  // --- 5. No Winning Condition Met ---
  return 0;
}


/**
 * Simulates many rounds to estimate RTP for Lucky Sevens Classic.
 *
 * @param rounds - Number of rounds to simulate.
 * @param betPerLine - Bet amount per line.
 * @param linesBet - Number of active paylines.
 * @param config - Game config (including houseEdge).
 * @returns Estimated RTP as a fraction (0-1).
 */
export function simulateLuckySevensRTP(
  rounds: number,
  betPerLine: number,
  linesBet: number,
  config: LuckySevensConfig = {}
): number {
  let totalBet    = 0;
  let totalPayout = 0;
  for (let i = 0; i < rounds; i++) {
    const state = createLuckySevensState(betPerLine, linesBet);
    spinLuckySevens(state, config);
    totalBet    += (betPerLine * linesBet);
    totalPayout += state.totalWin;
  }
  return totalPayout / totalBet;
}
