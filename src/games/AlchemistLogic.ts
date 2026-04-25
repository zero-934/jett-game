/**
 * @file AlchemistLogic.ts
 * @purpose Implements the core game logic for The Alchemist slot game, including reel spins, win calculations,
 *          free spin features, and a jackpot system, without any UI dependencies.
 * @author Agent 934
 * @date 2026-04-15
 * @license Proprietary — available for licensing
 */

import { ProvablyFairRNG } from '../shared/rng/ProvablyFairRNG';

// ─── Game Constants ─────────────────────────────────────────────────────────────────────────────
export const REELS_COUNT = 5;
export const ROWS_COUNT = 3;
export const BET_PER_LINE = 1;
export const LINES_COUNT = 25;
export const WILD_MULTIPLIER_CHANCE = 0.25;
export const FREE_SPIN_SCATTER_COUNT = 3;
export const FREE_SPINS_GRANTED = 10;
export const FREE_SPINS_RETRIGGER = 5;
export const TRANSMUTE_MIN = 1;  // min symbols transmuted per free spin
export const TRANSMUTE_MAX = 3;  // max symbols transmuted per free spin

// ─── Color Constants ────────────────────────────────────────────────────────────────────────────
export const GOLD = 0xc9a84c;
export const GOLD_STR = '#c9a84c';
export const DARK = 0x080812;
export const DARK_STR = '#080812';
export const COPPER = 0xb87333;
export const COPPER_STR = '#b87333';
export const AMBER = 0xff8c00;
export const AMBER_STR = '#ff8c00';

// ─── Jackpot System ─────────────────────────────────────────────────────────────────────────────
export type JackpotTier = 'PHILOSOPHER' | 'GRAND' | 'MINOR';
export interface JackpotResult { tier: JackpotTier; payout: number; }
export const JACKPOT_MULTIPLIERS: Record<JackpotTier, number> = { PHILOSOPHER: 1000, GRAND: 250, MINOR: 50 };
export const JACKPOT_PROBABILITIES: Record<JackpotTier, number> = { PHILOSOPHER: 0.0002, GRAND: 0.002, MINOR: 0.02 };

/**
 * Rolls for a jackpot based on probabilities.
 * @param bet The total bet amount for the spin.
 * @param rng A pseudo-random number generator function.
 * @returns A JackpotResult object if a jackpot is hit, otherwise null.
 * @example
 * const rng = getRandomSeedableRNG('mySeed');
 * const jackpot = rollJackpot(25, rng);
 * if (jackpot) { console.log(`Jackpot! Tier: ${jackpot.tier}, Payout: ${jackpot.payout}`); }
 */
export function rollJackpot(bet: number, rng: () => number): JackpotResult | null {
  for (const tier of (['PHILOSOPHER', 'GRAND', 'MINOR'] as JackpotTier[])) {
    if (rng() < JACKPOT_PROBABILITIES[tier]) {
      return { tier, payout: bet * JACKPOT_MULTIPLIERS[tier] };
    }
  }
  return null;
}

// ─── Symbols ────────────────────────────────────────────────────────────────────────────────────
export type AlchemistSymbol =
  | 'PHILOSOPHERS_STONE'  // highest
  | 'ELIXIR'              // high
  | 'GRIMOIRE'            // mid-high
  | 'CAULDRON'            // mid
  | 'HOURGLASS'           // mid-low
  | 'VIAL'                // low
  | 'MORTAR'              // low
  | 'RUNE'                // lowest
  | 'WILD'                // mysterious orb — substitutes all except SCATTER
  | 'SCATTER'             // alchemical circle — triggers free spins
  | 'TRANSMUTING';        // special: only appears during free spins, replaces low symbols

const HIGH_PAYING: AlchemistSymbol[] = ['PHILOSOPHERS_STONE', 'ELIXIR', 'GRIMOIRE'];
const LOW_PAYING: AlchemistSymbol[] = ['VIAL', 'MORTAR', 'RUNE']; // Used for Transmuting logic

// ─── Payout Table ───────────────────────────────────────────────────────────────────────────────
type PaySymbol = Exclude<AlchemistSymbol, 'WILD' | 'SCATTER' | 'TRANSMUTING'>;
export const PAYOUT_TABLE: Record<PaySymbol, Record<number, number>> = {
  PHILOSOPHERS_STONE: { 3: 10, 4: 50, 5: 200 },
  ELIXIR: { 3: 8, 4: 30, 5: 100 },
  GRIMOIRE: { 3: 5, 4: 20, 5: 75 },
  CAULDRON: { 3: 4, 4: 15, 5: 50 },
  HOURGLASS: { 3: 3, 4: 10, 5: 30 },
  VIAL: { 3: 2, 4: 8, 5: 20 },
  MORTAR: { 3: 2, 4: 6, 5: 15 },
  RUNE: { 3: 1, 4: 4, 5: 10 },
};

// ─── Paylines ───────────────────────────────────────────────────────────────────────────────────
export const PAYLINES: { reel: number; row: number }[][] = [
  // Horizontals
  [{ reel: 0, row: 1 }, { reel: 1, row: 1 }, { reel: 2, row: 1 }, { reel: 3, row: 1 }, { reel: 4, row: 1 }],
  [{ reel: 0, row: 0 }, { reel: 1, row: 0 }, { reel: 2, row: 0 }, { reel: 3, row: 0 }, { reel: 4, row: 0 }],
  [{ reel: 0, row: 2 }, { reel: 1, row: 2 }, { reel: 2, row: 2 }, { reel: 3, row: 2 }, { reel: 4, row: 2 }],
  // V-shapes
  [{ reel: 0, row: 0 }, { reel: 1, row: 1 }, { reel: 2, row: 2 }, { reel: 3, row: 1 }, { reel: 4, row: 0 }],
  [{ reel: 0, row: 2 }, { reel: 1, row: 1 }, { reel: 2, row: 0 }, { reel: 3, row: 1 }, { reel: 4, row: 2 }],
  [{ reel: 0, row: 0 }, { reel: 1, row: 0 }, { reel: 2, row: 1 }, { reel: 3, row: 0 }, { reel: 4, row: 0 }],
  [{ reel: 0, row: 2 }, { reel: 1, row: 2 }, { reel: 2, row: 1 }, { reel: 3, row: 2 }, { reel: 4, row: 2 }],
  [{ reel: 0, row: 1 }, { reel: 1, row: 0 }, { reel: 2, row: 0 }, { reel: 3, row: 0 }, { reel: 4, row: 1 }],
  [{ reel: 0, row: 1 }, { reel: 1, row: 2 }, { reel: 2, row: 2 }, { reel: 3, row: 2 }, { reel: 4, row: 1 }],
  [{ reel: 0, row: 0 }, { reel: 1, row: 1 }, { reel: 2, row: 1 }, { reel: 3, row: 1 }, { reel: 4, row: 0 }],
  [{ reel: 0, row: 2 }, { reel: 1, row: 1 }, { reel: 2, row: 1 }, { reel: 3, row: 1 }, { reel: 4, row: 2 }],
  [{ reel: 0, row: 0 }, { reel: 1, row: 0 }, { reel: 2, row: 1 }, { reel: 3, row: 2 }, { reel: 4, row: 2 }],
  [{ reel: 0, row: 2 }, { reel: 1, row: 2 }, { reel: 2, row: 1 }, { reel: 3, row: 0 }, { reel: 4, row: 0 }],
  [{ reel: 0, row: 1 }, { reel: 1, row: 0 }, { reel: 2, row: 1 }, { reel: 3, row: 0 }, { reel: 4, row: 1 }],
  [{ reel: 0, row: 1 }, { reel: 1, row: 2 }, { reel: 2, row: 1 }, { reel: 3, row: 2 }, { reel: 4, row: 1 }],
  [{ reel: 0, row: 0 }, { reel: 1, row: 1 }, { reel: 2, row: 0 }, { reel: 3, row: 1 }, { reel: 4, row: 0 }],
  [{ reel: 0, row: 2 }, { reel: 1, row: 1 }, { reel: 2, row: 2 }, { reel: 3, row: 1 }, { reel: 4, row: 2 }],
  [{ reel: 0, row: 1 }, { reel: 1, row: 1 }, { reel: 2, row: 0 }, { reel: 3, row: 1 }, { reel: 4, row: 1 }],
  [{ reel: 0, row: 1 }, { reel: 1, row: 1 }, { reel: 2, row: 2 }, { reel: 3, row: 1 }, { reel: 4, row: 1 }],
  [{ reel: 0, row: 0 }, { reel: 1, row: 2 }, { reel: 2, row: 0 }, { reel: 3, row: 2 }, { reel: 4, row: 0 }],
  [{ reel: 0, row: 2 }, { reel: 1, row: 0 }, { reel: 2, row: 2 }, { reel: 3, row: 0 }, { reel: 4, row: 2 }],
  [{ reel: 0, row: 0 }, { reel: 1, row: 1 }, { reel: 2, row: 0 }, { reel: 3, row: 0 }, { reel: 4, row: 0 }],
  [{ reel: 0, row: 2 }, { reel: 1, row: 1 }, { reel: 2, row: 2 }, { reel: 3, row: 2 }, { reel: 4, row: 2 }],
  [{ reel: 0, row: 1 }, { reel: 1, row: 0 }, { reel: 2, row: 2 }, { reel: 3, row: 0 }, { reel: 4, row: 1 }],
  [{ reel: 0, row: 0 }, { reel: 1, row: 0 }, { reel: 2, row: 0 }, { reel: 3, row: 1 }, { reel: 4, row: 1 }],
];

// ─── Reel Strips ────────────────────────────────────────────────────────────────────────────────
// Each strip is 30 symbols long. Balanced for ~97% RTP.
// Counts per strip: PHILOSOPHERS_STONE:1, ELIXIR:2, GRIMOIRE:3, CAULDRON:4, HOURGLASS:4, VIAL:5, MORTAR:5, RUNE:4, WILD:1, SCATTER:1
const BASE_REEL_STRIP: AlchemistSymbol[] = [
  'PHILOSOPHERS_STONE',
  'ELIXIR', 'ELIXIR',
  'GRIMOIRE', 'GRIMOIRE', 'GRIMOIRE',
  'CAULDRON', 'CAULDRON', 'CAULDRON', 'CAULDRON',
  'HOURGLASS', 'HOURGLASS', 'HOURGLASS', 'HOURGLASS',
  'VIAL', 'VIAL', 'VIAL', 'VIAL', 'VIAL',
  'MORTAR', 'MORTAR', 'MORTAR', 'MORTAR', 'MORTAR',
  'RUNE', 'RUNE', 'RUNE', 'RUNE',
  'WILD',
  'SCATTER',
];

/**
 * Shuffles an array in place using Fisher-Yates algorithm.
 * @param array The array to shuffle.
 * @param rng A pseudo-random number generator function.
 * @returns The shuffled array.
 */
function shuffleArray<T>(array: T[], rng: () => number): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// Generate 5 unique (shuffled) reel strips
export const REEL_STRIPS: AlchemistSymbol[][] = Array.from({ length: REELS_COUNT }, (_) => {
  const _stripRng = new ProvablyFairRNG();
  const rng = _stripRng.random.bind(_stripRng); // Use a distinct seed per strip for initialization
  return shuffleArray([...BASE_REEL_STRIP], rng);
});


// ─── Interfaces ─────────────────────────────────────────────────────────────────────────────────
export interface AlchemistConfig {
  houseEdge?: number; // Not used in this logic, but common in config for external simulations
  rng?: () => number;
  forcedReelStops?: AlchemistSymbol[][]; // For testing or specific scenarios
  skipTransmuting?: boolean; // For RTP simulation, skips visual transmutation
}

export interface WinLine {
  paylineIndex: number;
  symbol: PaySymbol;
  count: number;
  payout: number;
  positions: { reel: number; row: number }[];
  isWildContributed: boolean;
  hasWildMultiplier: boolean;
}

export interface AlchemistState {
  bet: number;
  linesBet: number;
  reelStops: AlchemistSymbol[][]; // The actual symbols landed on the reels
  transmutingPositions: { reel: number; row: number }[]; // Positions showing TRANSMUTING during free spins (for UI)
  transmutedSymbols: { reel: number; row: number; symbol: AlchemistSymbol }[]; // Revealed high-paying symbols that replaced TRANSMUTING
  totalWin: number;
  winLines: WinLine[];
  isComplete: boolean; // True if no more free spins or base game spin
  freeSpinsRemaining: number;
  lastWinMultiplier: number; // Multiplier applied to the last spin's win (e.g., from WILD)
  scatterCount: number;
  isFreeSpinTriggered: boolean; // Was a new free spin round triggered this spin?
  isFreeSpinRetriggered: boolean; // Were free spins retriggered this spin?
  jackpotResult: JackpotResult | null;
}

// ─── Internal Helper Functions ──────────────────────────────────────────────────────────────────

/**
 * Calculates all payline wins for a given reel grid.
 * @param reelGrid The 2D array of symbols on the reels.
 * @param linesBet The number of lines being bet on.
 * @param rng A pseudo-random number generator function.
 * @returns An object containing the total payout and a list of individual win lines.
 */
function calculateWins(reelGrid: AlchemistSymbol[][], linesBet: number, rng: () => number): { totalPayout: number; winLines: WinLine[] } {
  let totalPayout = 0;
  const winLines: WinLine[] = [];

  for (let i = 0; i < linesBet; i++) {
    const payline = PAYLINES[i];
    if (!payline) continue; // Should not happen if linesBet <= LINES_COUNT

    let symbolToMatch: PaySymbol | undefined = undefined;
    let currentCount = 0;
    const positions: { reel: number; row: number }[] = [];
    let isWildContributed = false;

    for (let j = 0; j < REELS_COUNT; j++) {
      const { reel, row } = payline[j];
      const symbol = reelGrid[reel][row];

      // SCATTER symbols do not contribute to payline wins
      if (symbol === 'SCATTER') {
        break; // A scatter breaks a potential win line
      }

      if (symbolToMatch === undefined) {
        // First symbol on the line
        if (symbol === 'WILD') {
          // If the first symbol is WILD, we need to find the first non-WILD non-SCATTER to establish symbolToMatch
          // Or if no such symbol, it can still act as a WILD for later WILDs or matching symbols
          isWildContributed = true;
          positions.push({ reel, row });
          currentCount++;
          // Defer symbolToMatch determination until we find a non-WILD or run out of reels
          // For now, treat as if it could match anything
        } else if (symbol === 'TRANSMUTING') {
          // TRANSMUTING should have been replaced in reelGridForWinCalc, so this branch should not be hit.
          // If it is, treat as non-matching.
          break;
        } else {
          symbolToMatch = symbol as PaySymbol;
          positions.push({ reel, row });
          currentCount++;
        }
      } else {
        // Subsequent symbols
        if (symbol === symbolToMatch || symbol === 'WILD') {
          if (symbol === 'WILD') {
            isWildContributed = true;
          }
          positions.push({ reel, row });
          currentCount++;
        } else {
          // Mismatch, line broken
          break;
        }
      }

      // If symbolToMatch is still undefined but we have wilds, try to resolve it.
      if (symbolToMatch === undefined && symbol !== 'WILD') {
        // This means first symbol was WILD, and now we found a non-WILD symbol.
        // This non-WILD symbol determines the line's type.
        symbolToMatch = symbol as PaySymbol;
        // Check if previous WILDs can form a line with this new symbolToMatch.
        // All previous wilds should match this symbol.
      }
    }

    // After iterating, if symbolToMatch is still undefined (e.g., all wilds), check if any non-wilds were implicitly matched
    if (symbolToMatch === undefined) {
      // If the line started with WILDs and only had WILDs, it can't form a win unless there's a specific payout for 'all wilds'.
      // In this game, WILDs only substitute, they don't have their own payout for matching themselves.
      // So, if symbolToMatch is still undefined here, it means no actual symbol was matched, only wilds.
      continue;
    }

    if (currentCount >= 3 && PAYOUT_TABLE[symbolToMatch] && PAYOUT_TABLE[symbolToMatch][currentCount]) {
      let payout = PAYOUT_TABLE[symbolToMatch][currentCount] * BET_PER_LINE;
      let hasWildMultiplier = false;

      // Apply wild multiplier if a wild contributed and RNG allows
      if (isWildContributed && rng() < WILD_MULTIPLIER_CHANCE) {
        payout *= 2;
        hasWildMultiplier = true;
      }

      totalPayout += payout;
      winLines.push({
        paylineIndex: i,
        symbol: symbolToMatch,
        count: currentCount,
        payout,
        positions: positions.slice(0, currentCount), // Ensure positions only include winning symbols
        isWildContributed,
        hasWildMultiplier,
      });
    }
  }

  return { totalPayout, winLines };
}


// ─── Exported Functions ─────────────────────────────────────────────────────────────────────────

/**
 * Initializes a new Alchemist game state.
 * @param bet The bet amount per line.
 * @param linesBet The number of lines being bet on.
 * @returns The initial AlchemistState object.
 * @example
 * const initialState = createAlchemistState(BET_PER_LINE, LINES_COUNT);
 * console.log(initialState);
 */
export function createAlchemistState(bet: number, linesBet: number): AlchemistState {
  // Fill reelStops with 'RUNE' as a placeholder initial state
  const initialReelStops: AlchemistSymbol[][] = Array.from({ length: REELS_COUNT }, () =>
    Array(ROWS_COUNT).fill('RUNE')
  );

  return {
    bet,
    linesBet,
    reelStops: initialReelStops,
    transmutingPositions: [],
    transmutedSymbols: [],
    totalWin: 0,
    winLines: [],
    isComplete: true, // Initially complete, ready for first spin
    freeSpinsRemaining: 0,
    lastWinMultiplier: 1,
    scatterCount: 0,
    isFreeSpinTriggered: false,
    isFreeSpinRetriggered: false,
    jackpotResult: null,
  };
}

/**
 * Performs a single spin of The Alchemist slot game.
 * @param state The current game state.
 * @param config Optional configuration for the spin (e.g., specific RNG, forced reel stops).
 * @returns A new AlchemistState object reflecting the result of the spin. The input state is not mutated.
 * @example
 * let currentState = createAlchemistState(BET_PER_LINE, LINES_COUNT);
 * currentState = spinAlchemist(currentState, { rng: getRandomSeedableRNG('spin1') });
 * console.log(currentState.totalWin);
 */
export function spinAlchemist(state: AlchemistState, config?: AlchemistConfig): AlchemistState {
  const _defaultRng = new ProvablyFairRNG();
  const rng = config?.rng ?? _defaultRng.random.bind(_defaultRng);

  // Create a deep copy of the state to ensure immutability
  const newState: AlchemistState = {
    ...state,
    reelStops: state.reelStops.map(reel => [...reel]),
    transmutingPositions: [],
    transmutedSymbols: [],
    totalWin: 0,
    winLines: [],
    lastWinMultiplier: 1,
    scatterCount: 0,
    isFreeSpinTriggered: false,
    isFreeSpinRetriggered: false,
    jackpotResult: null,
  };

  // 1. Decrement free spins if applicable
  if (newState.freeSpinsRemaining > 0) {
    newState.freeSpinsRemaining--;
  }

  // 2. Generate reel stops
  if (config?.forcedReelStops) {
    newState.reelStops = config.forcedReelStops.map(reel => [...reel]);
  } else {
    for (let reel = 0; reel < REELS_COUNT; reel++) {
      const strip = REEL_STRIPS[reel];
      const startIndex = Math.floor(rng() * strip.length);
      for (let row = 0; row < ROWS_COUNT; row++) {
        newState.reelStops[reel][row] = strip[(startIndex + row) % strip.length];
      }
    }
  }

  // Create a grid for win calculation, initially a copy of actual reel stops
  const reelGridForWinCalc: AlchemistSymbol[][] = newState.reelStops.map(reel => [...reel]);

  // 3. If in free spin and not skipping transmuting:
  if (state.freeSpinsRemaining > 0 && !config?.skipTransmuting) {
    const eligiblePositions: { reel: number; row: number }[] = [];
    for (let reel = 0; reel < REELS_COUNT; reel++) {
      for (let row = 0; row < ROWS_COUNT; row++) {
        const symbol = newState.reelStops[reel][row];
        // Eligible for transmutation: non-WILD, non-SCATTER, and low-paying
        if (symbol !== 'WILD' && symbol !== 'SCATTER' && LOW_PAYING.includes(symbol)) {
          eligiblePositions.push({ reel, row });
        }
      }
    }

    if (eligiblePositions.length > 0) {
      const numToTransmute = Math.floor(rng() * (TRANSMUTE_MAX - TRANSMUTE_MIN + 1)) + TRANSMUTE_MIN;
      shuffleArray(eligiblePositions, rng); // Randomly pick positions

      for (let i = 0; i < Math.min(numToTransmute, eligiblePositions.length); i++) {
        const { reel, row } = eligiblePositions[i];
        newState.transmutingPositions.push({ reel, row });

        // For win calculation, replace the low-paying symbol with TRANSMUTING first,
        // then transmute it to a high-paying one. This makes `TRANSMUTING` effectively visible
        // for UI purposes (transmutingPositions), but for actual wins, it's a high-paying symbol.
        const transmutedSymbol = HIGH_PAYING[Math.floor(rng() * HIGH_PAYING.length)];
        reelGridForWinCalc[reel][row] = transmutedSymbol; // This is the symbol used for win evaluation
        newState.transmutedSymbols.push({ reel, row, symbol: transmutedSymbol });
      }
    }
  }


  // 4. Roll jackpot
  newState.jackpotResult = rollJackpot(newState.bet * newState.linesBet, rng);
  if (newState.jackpotResult) {
    newState.totalWin += newState.jackpotResult.payout;
  }

  // 5. Calculate wins across all 25 paylines
  const { totalPayout, winLines } = calculateWins(reelGridForWinCalc, newState.linesBet, rng);
  newState.totalWin += totalPayout;
  newState.winLines = winLines;

  // 6. Check for scatters for free spins
  let currentScatterCount = 0;
  for (let reel = 0; reel < REELS_COUNT; reel++) {
    for (let row = 0; row < ROWS_COUNT; row++) {
      if (newState.reelStops[reel][row] === 'SCATTER') {
        currentScatterCount++;
      }
    }
  }
  newState.scatterCount = currentScatterCount;

  if (currentScatterCount >= FREE_SPIN_SCATTER_COUNT) {
    if (state.freeSpinsRemaining === 0) {
      // New free spin trigger
      newState.freeSpinsRemaining += FREE_SPINS_GRANTED;
      newState.isFreeSpinTriggered = true;
    } else {
      // Retrigger
      newState.freeSpinsRemaining += FREE_SPINS_RETRIGGER;
      newState.isFreeSpinRetriggered = true;
    }
  }

  // Update isComplete
  newState.isComplete = newState.freeSpinsRemaining === 0;

  return newState;
}

/**
 * Simulates multiple rounds of Alchemist to estimate the Return To Player (RTP).
 * This function is optimized for simulation speed, so it skips visual-only effects like detailed transmuting.
 * @param rounds The number of spin rounds to simulate.
 * @param betPerLine The bet amount per line for the simulation.
 * @param linesBet The number of lines to bet on for the simulation.
 * @param config Optional configuration for the simulation (e.g., custom RNG).
 * @returns The calculated RTP as a decimal (e.g., 0.97 for 97%).
 * @example
 * const rtp = simulateAlchemistRTP(100000, BET_PER_LINE, LINES_COUNT);
 * console.log(`Simulated RTP: ${rtp * 100}%`);
 */
export function simulateAlchemistRTP(rounds: number, betPerLine: number, linesBet: number, config?: AlchemistConfig): number {
  const _simRng = new ProvablyFairRNG();
  const rng = config?.rng ?? _simRng.random.bind(_simRng);
  const simConfig: AlchemistConfig = { ...config, rng, skipTransmuting: true }; // Force skipTransmuting for speed

  let totalBet = 0;
  let totalWin = 0;
  let currentState = createAlchemistState(betPerLine, linesBet);

  for (let i = 0; i < rounds; i++) {
    // Only place a bet if it's a base game spin (or first spin of free game)
    // The "bet" for free spins is considered paid for by the trigger spin
    if (currentState.freeSpinsRemaining === 0 || currentState.isFreeSpinTriggered) {
      totalBet += betPerLine * linesBet;
    }

    currentState = spinAlchemist(currentState, simConfig);
    totalWin += currentState.totalWin;

    // If free spins just ended, reset to base game state for the next spin
    if (currentState.isComplete && currentState.freeSpinsRemaining === 0 && !currentState.isFreeSpinTriggered) {
      currentState = createAlchemistState(betPerLine, linesBet);
      currentState.freeSpinsRemaining = 0; // Ensure it's explicitly 0
    }
  }

  return totalBet > 0 ? totalWin / totalBet : 0;
}
