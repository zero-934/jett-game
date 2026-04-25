/**
 * @file SurgeLogic.ts
 * @purpose Implements the core game logic for the Surge slot game, including spin mechanics, win evaluation, and special features.
 * @author Agent 934
 * @date 2026-04-16
 * @license Proprietary — available for licensing
 */

import { ProvablyFairRNG, createRNG } from '../shared/rng/ProvablyFairRNG';

export type SurgeSymbol = 'BOLT' | 'ARC' | 'COIL' | 'SPARK' | 'STATIC' | 'WILD' | 'SCATTER';

export interface SurgeCell {
  symbol: SurgeSymbol;
  row: number;
  col: number;
  isWinning: boolean;
}

export interface SurgeCluster {
  symbol: SurgeSymbol;
  cells: { row: number; col: number }[];
  payout: number;
}

export interface SurgeState {
  bet: number;
  grid: SurgeCell[][];
  surgeMeter: number; // 0–5
  totalWin: number;
  clusters: SurgeCluster[];
  surgeSpinsRemaining: number; // 0–3
  isSurgeSpin: boolean; // true = this spin has a wild reel
  surgeWildReel: number; // which reel (0,1,2) is wild during surge, -1 if none
  isInCrownFlip: boolean;
  crownFlipWin: number;
  crownFlipChain: number;
  freeSpinsRemaining: number;
  scatterCount: number;
  isFreeSpinTriggered: boolean; // true if free spins were just triggered
  isComplete: boolean; // true if the current spin/flip sequence is resolved
  lastSpinSeed: string;
}

export interface SurgeConfig {
  rng?: ProvablyFairRNG;
}

// --- Constants ---
const GRID_ROWS = 3;
const GRID_COLS = 3;

const SURGE_METER_MAX = 5;
const SURGE_SPINS_COUNT = 3;
const FREE_SPINS_COUNT = 5;

const RTP_SIM_MAX_CASCADES = 50; // Safety counter for RTP simulation loops

const SYMBOL_WEIGHTS: { value: SurgeSymbol; weight: number }[] = [
  { value: 'BOLT', weight: 1 },
  { value: 'ARC', weight: 2 },
  { value: 'COIL', weight: 3 },
  { value: 'SPARK', weight: 4 },
  { value: 'STATIC', weight: 5 },
  { value: 'WILD', weight: 1 },
  { value: 'SCATTER', weight: 1 },
];

const SYMBOL_PAYOUT_MULTIPLIERS: Record<SurgeSymbol, number> = {
  BOLT: 0.8,
  ARC: 0.5,
  COIL: 0.35,
  SPARK: 0.25,
  STATIC: 0.15,
  WILD: 0, // WILD substitutes, doesn't have its own payout
  SCATTER: 0, // SCATTER triggers free spins, doesn't have its own payout
};

// Cluster size multipliers (index 0 = 3 symbols, index 1 = 4 symbols, etc.)
const CLUSTER_SIZE_MULTIPLIERS: number[] = [
  1, // 3 connected = base × 1
  2.5, // 4 connected = base × 2.5
  5, // 5 connected = base × 5
  8, // 6 connected = base × 8
  12, // 7 connected = base × 12
  18, // 8 connected = base × 18
  25, // 9 connected = base × 25 (full board)
];

/**
 * Creates an initial Surge game state.
 * @param bet The initial bet amount for the game.
 * @returns The initial SurgeState object.
 */
export function createSurgeState(bet: number): SurgeState {
  const initialGrid: SurgeCell[][] = Array.from({ length: GRID_ROWS }, (_, row) =>
    Array.from({ length: GRID_COLS }, (_, col) => ({
      symbol: 'STATIC', // Default symbol, will be overwritten on first spin
      row,
      col,
      isWinning: false,
    }))
  );

  return {
    bet,
    grid: initialGrid,
    surgeMeter: 0,
    totalWin: 0,
    clusters: [],
    surgeSpinsRemaining: 0,
    isSurgeSpin: false,
    surgeWildReel: -1,
    isInCrownFlip: false,
    crownFlipWin: 0,
    crownFlipChain: 0,
    freeSpinsRemaining: 0,
    scatterCount: 0,
    isFreeSpinTriggered: false,
    isComplete: true, // Initially complete, waiting for first spin
    lastSpinSeed: '',
  };
}

/**
 * Executes a single spin of the Surge slot game.
 * This function handles symbol generation, surge spin mechanics, and updates the game state.
 * @param state The current SurgeState.
 * @param config Optional configuration including an RNG instance.
 * @returns A new SurgeState object reflecting the result of the spin.
 */
export function spinSurge(state: SurgeState, config?: SurgeConfig): SurgeState {
  const newState: SurgeState = { ...state };
  const rng = config?.rng || createRNG();
  newState.lastSpinSeed = rng.getSeed();

  newState.totalWin = 0;
  newState.clusters = [];
  newState.scatterCount = 0;
  newState.isFreeSpinTriggered = false;
  newState.isComplete = false; // Spin is in progress

  // Handle free spins
  if (newState.freeSpinsRemaining > 0) {
    newState.freeSpinsRemaining--;
  }

  // Handle Surge Spins
  if (newState.surgeSpinsRemaining > 0) {
    newState.isSurgeSpin = true;
    // Pick a random reel to be wild if not already set for this surge spin sequence
    if (newState.surgeWildReel === -1) {
      newState.surgeWildReel = rng.randomInt(0, GRID_COLS - 1);
    }
    newState.surgeSpinsRemaining--;
  } else {
    newState.isSurgeSpin = false;
    newState.surgeWildReel = -1;
  }

  // Generate new grid
  const newGrid: SurgeCell[][] = Array.from({ length: GRID_ROWS }, (_, row) =>
    Array.from({ length: GRID_COLS }, (_, col) => {
      let symbol: SurgeSymbol;
      if (newState.isSurgeSpin && col === newState.surgeWildReel) {
        symbol = 'WILD'; // Force wild reel
      } else {
        symbol = rng.weightedChoice(SYMBOL_WEIGHTS);
      }
      return { symbol, row, col, isWinning: false };
    })
  );
  newState.grid = newGrid;

  // Evaluate clusters and update state
  const stateAfterEvaluation = evaluateSurgeClusters(newState);
  Object.assign(newState, stateAfterEvaluation); // Merge changes from evaluation

  // Update Surge Meter (only if it was a winning spin and not a surge/free spin)
  if (newState.totalWin > 0 && !state.isSurgeSpin && !state.isFreeSpinTriggered) {
    newState.surgeMeter++;
    if (newState.surgeMeter >= SURGE_METER_MAX) {
      newState.surgeSpinsRemaining = SURGE_SPINS_COUNT;
      newState.surgeMeter = 0;
    }
  }

  // Check for Free Spin trigger
  if (newState.scatterCount >= 3 && newState.freeSpinsRemaining === 0) {
    newState.freeSpinsRemaining = FREE_SPINS_COUNT;
    newState.isFreeSpinTriggered = true;
  }

  // Determine if crown flip should be initiated
  if (newState.totalWin > 0 && !newState.isInCrownFlip && !newState.isFreeSpinTriggered) {
    newState.isInCrownFlip = true;
    newState.crownFlipWin = newState.totalWin;
    newState.crownFlipChain = 0;
  } else {
    // If no crown flip, and no free spins triggered, the spin is complete
    newState.isComplete = !newState.isInCrownFlip && !newState.isFreeSpinTriggered && newState.freeSpinsRemaining === 0;
  }

  return newState;
}

/**
 * Evaluates the current grid for winning clusters and scatter symbols.
 * This function identifies connected symbols (horizontally/vertically) and calculates payouts.
 * @param state The current SurgeState.
 * @returns A new SurgeState object with updated clusters, totalWin, and scatterCount.
 */
export function evaluateSurgeClusters(state: SurgeState): SurgeState {
  const newState: SurgeState = { ...state };
  newState.clusters = [];
  newState.totalWin = 0;
  newState.scatterCount = 0;

  const visited: boolean[][] = Array.from({ length: GRID_ROWS }, () =>
    Array.from({ length: GRID_COLS }, () => false)
  );

  // Reset isWinning flag for all cells
  newState.grid.forEach((row) => row.forEach((cell) => (cell.isWinning = false)));

  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      const cell = newState.grid[r][c];

      if (cell.symbol === 'SCATTER') {
        newState.scatterCount++;
        continue; // Scatters are not part of clusters
      }

      if (!visited[r][c]) {
        const currentClusterCells: { row: number; col: number }[] = [];
        const queue: { row: number; col: number }[] = [{ row: r, col: c }];
        visited[r][c] = true;

        const targetSymbol = cell.symbol; // The symbol to cluster (or WILD)

        let head = 0;
        while (head < queue.length) {
          const { row: currR, col: currC } = queue[head++];
          currentClusterCells.push({ row: currR, col: currC });

          const neighbors = [
            { row: currR - 1, col: currC }, // Up
            { row: currR + 1, col: currC }, // Down
            { row: currR, col: currC - 1 }, // Left
            { row: currR, col: currC + 1 }, // Right
          ];

          for (const neighbor of neighbors) {
            const { row: nR, col: nC } = neighbor;

            if (
              nR >= 0 &&
              nR < GRID_ROWS &&
              nC >= 0 &&
              nC < GRID_COLS &&
              !visited[nR][nC]
            ) {
              const neighborSymbol = newState.grid[nR][nC].symbol;
              // A neighbor matches if it's the target symbol OR it's a WILD (and target isn't SCATTER)
              if (
                neighborSymbol !== 'SCATTER' &&
                (neighborSymbol === targetSymbol || neighborSymbol === 'WILD')
              ) {
                visited[nR][nC] = true;
                queue.push(neighbor);
              }
            }
          }
        }

        if (currentClusterCells.length >= 3) {
          const clusterSize = currentClusterCells.length;
          const basePayoutMultiplier = SYMBOL_PAYOUT_MULTIPLIERS[targetSymbol];
          const clusterMultiplierIndex = Math.min(
            clusterSize - 3,
            CLUSTER_SIZE_MULTIPLIERS.length - 1
          );
          const clusterPayoutMultiplier = CLUSTER_SIZE_MULTIPLIERS[clusterMultiplierIndex];

          const payout = newState.bet * basePayoutMultiplier * clusterPayoutMultiplier;

          if (payout > 0) {
            newState.clusters.push({
              symbol: targetSymbol,
              cells: currentClusterCells,
              payout,
            });
            newState.totalWin += payout;

            // Mark winning cells
            currentClusterCells.forEach(({ row, col }) => {
              newState.grid[row][col].isWinning = true;
            });
          }
        }
      }
    }
  }

  return newState;
}

/**
 * Executes a Crown Flip gamble, doubling the current win or losing it all.
 * @param state The current SurgeState.
 * @param config Optional configuration including an RNG instance.
 * @returns A new SurgeState object reflecting the result of the flip.
 */
export function flipCrown(state: SurgeState, config?: SurgeConfig): SurgeState {
  const newState: SurgeState = { ...state };
  const rng = config?.rng || createRNG();

  if (!newState.isInCrownFlip) {
    return newState; // Cannot flip if not in crown flip mode
  }

  const isWin = rng.random() < 0.5; // 50/50 chance

  if (isWin) {
    newState.crownFlipWin *= 2;
    newState.crownFlipChain++;
  } else {
    newState.crownFlipWin = 0;
    newState.isInCrownFlip = false;
    newState.isComplete = true; // Crown flip sequence ends
  }

  return newState;
}

/**
 * Accepts the current win amount during a Crown Flip, ending the gamble.
 * @param state The current SurgeState.
 * @returns A new SurgeState object with the crown flip resolved.
 */
export function walkCrown(state: SurgeState): SurgeState {
  const newState: SurgeState = { ...state };

  if (!newState.isInCrownFlip) {
    return newState; // Cannot walk if not in crown flip mode
  }

  newState.totalWin = newState.crownFlipWin;
  newState.isInCrownFlip = false;
  newState.crownFlipWin = 0;
  newState.crownFlipChain = 0;
  newState.isComplete = true; // Crown flip sequence ends

  return newState;
}

/**
 * Simulates multiple rounds of the Surge slot game to estimate its Return To Player (RTP).
 * This simulation includes spins, free spins, surge spins, and crown flips (always walking).
 * @param rounds The number of game rounds to simulate.
 * @param bet The bet amount for each round.
 * @param config Optional configuration including an RNG instance.
 * @returns The calculated RTP as a ratio (e.g., 0.95 for 95%).
 */
export function simulateSurgeRTP(rounds: number, bet: number, config?: SurgeConfig): number {
  let totalBet = 0;
  let totalWin = 0;
  const rng = config?.rng || createRNG();

  for (let i = 0; i < rounds; i++) {
    let state = createSurgeState(bet);
    let currentRoundBet = 0;
    let currentRoundWin = 0;
    let cascadeCounter = 0; // Safety counter for free/surge spin loops

    // Initial spin
    if (state.freeSpinsRemaining === 0) {
      currentRoundBet += state.bet;
    }
    state = spinSurge(state, { rng }); // Use shared RNG for simulation
    currentRoundWin += state.totalWin;

    // Handle free spins and surge spins that might trigger
    while (
      (state.freeSpinsRemaining > 0 || state.surgeSpinsRemaining > 0) &&
      cascadeCounter < RTP_SIM_MAX_CASCADES
    ) {
      if (state.freeSpinsRemaining === 0 && state.surgeSpinsRemaining === 0) {
        // If both are 0, but free spins were just triggered, we need to process them
        if (state.isFreeSpinTriggered) {
          // The first free spin is effectively the next spin
        } else {
          break; // No more special spins
        }
      }

      if (state.freeSpinsRemaining === 0) {
        // If free spins just ended, ensure isFreeSpinTriggered is false for next spin
        state.isFreeSpinTriggered = false;
      }

      if (state.freeSpinsRemaining === 0 && state.surgeSpinsRemaining === 0) {
        // If both are 0, and no new trigger, break
        break;
      }

      state = spinSurge(state, { rng });
      currentRoundWin += state.totalWin;
      cascadeCounter++;
    }

    // Handle Crown Flip (always walk in simulation)
    if (state.isInCrownFlip) {
      state = walkCrown(state);
      currentRoundWin = state.totalWin; // totalWin is updated by walkCrown
    }

    totalBet += currentRoundBet;
    totalWin += currentRoundWin;
  }

  return totalBet > 0 ? totalWin / totalBet : 0;
}
