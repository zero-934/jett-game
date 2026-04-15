/**
 * @file CosmicQuestLogic.ts
 * @purpose Pure game logic for Cosmic Quest slot — symbol definitions, paylines,
 *          RNG reel stops, win evaluation, and payout calculation. No Phaser.
 * @author C-3PO
 * @date 2026-04-14
 * @license Proprietary – available for licensing
 */

import { getRandomSeedableRNG } from '../utils/RNG'; // Assuming a central RNG utility

/** Types of symbols on the reels for Cosmic Quest. */
export type CosmicQuestSymbol =
  'ROCKET' | 'ALIEN' | 'PLANET' | 'STAR' | 'MOON' |
  'A' | 'K' | 'Q' | 'J' | '10' |
  'WILD' | 'SCATTER';

/** Configuration for a Cosmic Quest slot instance. */
export interface CosmicQuestConfig {
  houseEdge?: number; // 0.04 for 96% RTP
  rng?: () => number;
  overrideReelStops?: CosmicQuestSymbol[][]; // For deterministic testing
}

/** Full Cosmic Quest slot game state. */
export interface CosmicQuestState {
  bet: number;
  linesBet: number; // Number of active paylines (e.g., 25)
  reelStops: CosmicQuestSymbol[][]; // Final symbols visible on reels (e.g., 5x3 grid)
  totalWin: number;
  isComplete: boolean;
  freeSpinsRemaining: number;
}

const DEFAULT_HOUSE_EDGE = 0.03; // 97% RTP
const REELS_COUNT        = 5;
const ROWS_COUNT         = 3;
const TOTAL_PAYLINES     = 25; // Example, will define actual payline patterns later

// All symbols, ordered by rough frequency (common to rare)
const SYMBOLS: CosmicQuestSymbol[] = [
  '10', 'J', 'Q', 'K', 'A',
  'MOON', 'STAR', 'PLANET',
  'ALIEN', 'ROCKET',
  'WILD', 'SCATTER',
];

// Mapping symbols to their values for payouts (conceptual, will be refined)
const SYMBOL_PAYOUTS: { [key in CosmicQuestSymbol]: number } = {
  'ROCKET': 600,
  'ALIEN': 500,
  'PLANET': 400,
  'STAR': 300,
  'MOON': 200,
  'A': 100,
  'K': 75,
  'Q': 50,
  'J': 25,
  '10': 10,
  'WILD': 0, // Wild has no direct payout, only substitutes
  'SCATTER': 0, // Scatter has no direct payout, only triggers free spins
};

// Reel strip definitions (simplified for now, will be more complex for actual RTP)
const REEL_STRIPS: CosmicQuestSymbol[][] = [
  // Reel 1
  ['10', 'J', 'Q', 'K', 'A', 'MOON', 'STAR', 'WILD', 'SCATTER', '10', 'J', 'Q', 'K', 'A', 'ROCKET', 'ALIEN'],
  // Reel 2
  ['J', 'Q', 'K', 'A', 'MOON', 'STAR', 'PLANET', 'WILD', '10', 'J', 'Q', 'K', 'A', 'ROCKET', 'SCATTER'],
  // Reel 3
  ['Q', 'K', 'A', 'MOON', 'STAR', 'ALIEN', 'WILD', 'SCATTER', '10', 'J', 'Q', 'K', 'A', 'PLANET', 'ROCKET'],
  // Reel 4
  ['K', 'A', 'MOON', 'STAR', 'PLANET', 'ALIEN', 'WILD', '10', 'J', 'Q', 'K', 'A', 'ROCKET', 'SCATTER'],
  // Reel 5
  ['A', 'MOON', 'STAR', 'ALIEN', 'ROCKET', 'WILD', 'SCATTER', '10', 'J', 'Q', 'K', 'A', 'PLANET'],
];

// Payline definitions (same as Wild Frontier for now, can be customized later)
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

  // More complex patterns to reach 25
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
 * Creates an initial Cosmic Quest slot game state.
 *
 * @param bet - Wager in credits per line.
 * @param linesBet - Number of active paylines.
 * @returns Fresh CosmicQuestState.
 */
export function createCosmicQuestState(bet: number, linesBet: number): CosmicQuestState {
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
 * Executes a single spin and determines wins for Cosmic Quest.
 *
 * @param state - Current game state (mutated).
 * @param config - Game configuration.
 * @returns Updated state with spin result.
 */
export function spinCosmicQuest(state: CosmicQuestState, config: CosmicQuestConfig = {}): CosmicQuestState {
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
  const currentSymbolsOnGrid: CosmicQuestSymbol[][] = state.reelStops;

  // Count scatters
  currentSymbolsOnGrid.forEach(reel => {
    reel.forEach(symbol => {
      if (symbol === 'SCATTER') {
        scattersHit++;
      }
    });
  });

  // Trigger free spins (e.g., 3+ scatters for 12 free spins in Cosmic Quest)
  if (scattersHit >= 3) {
    state.freeSpinsRemaining += 12; // Cosmic Quest awards 12 free spins
  }

  // Evaluate paylines
  for (let i = 0; i < state.linesBet; i++) {
    const payline = PAYLINES[i];
    if (!payline) continue;

    let lineSymbols: CosmicQuestSymbol[] = [];
    for (const [reelIdx, rowIdx] of payline) {
      if (currentSymbolsOnGrid[reelIdx] && currentSymbolsOnGrid[reelIdx][rowIdx]) {
        lineSymbols.push(currentSymbolsOnGrid[reelIdx][rowIdx]);
      } else {
        lineSymbols.push('10');
      }
    }

    const winAmount = evaluateCosmicQuestPayline(lineSymbols);
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
 * Evaluates a single payline for a win and returns the payout for Cosmic Quest.
 *
 * @param lineSymbols - Array of symbols on the payline.
 * @returns Payout amount for this line.
 */
function evaluateCosmicQuestPayline(lineSymbols: CosmicQuestSymbol[]): number {
  if (lineSymbols.length !== REELS_COUNT) return 0;

  let primarySymbol: CosmicQuestSymbol | null = null;
  for (const symbol of lineSymbols) {
    if (symbol !== 'WILD') {
      primarySymbol = symbol;
      break;
    }
  }

  if (!primarySymbol) {
    // All wilds, evaluate as highest paying symbol (ROCKET)
    primarySymbol = 'ROCKET';
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
 * Simulates many rounds to estimate RTP for Cosmic Quest.
 *
 * @param rounds - Number of rounds to simulate.
 * @param betPerLine - Bet amount per line.
 * @param linesBet - Number of active paylines.
 * @param config - Game config (including houseEdge).
 * @returns Estimated RTP as a fraction (0-1).
 */
export function simulateCosmicQuestRTP(
  rounds: number,
  betPerLine: number,
  linesBet: number,
  config: CosmicQuestConfig = {}
): number {
  let totalBet    = 0;
  let totalPayout = 0;
  for (let i = 0; i < rounds; i++) {
    const state = createCosmicQuestState(betPerLine, linesBet);
    spinCosmicQuest(state, config);
    totalBet    += (betPerLine * linesBet);
    totalPayout += state.totalWin;
  }
  return totalPayout / totalBet;
}
