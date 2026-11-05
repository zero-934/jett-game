/**
 * @file InfernoLogic.ts
 * @purpose Implements the core game logic for the Inferno slot game, including grid generation, cluster evaluation, cascading, and special mechanics like Heat Meter and Crown Flip.
 * @author Agent 934
 * @date 2026-04-16 (inferno-polish-001 revision 2026-11-05)
 * @license Proprietary – available for licensing
 *
 * Revision notes (inferno-polish-001, math version `inferno-math-2`):
 * - Cascade survivors now keep top-to-bottom order (gravity). The original collected survivors
 *   bottom-to-top, reversing columns. This is a bug fix that changes returns; see the report.
 * - `evaluateClusters()` is idempotent for a given cascade step (no duplicate credit on re-call).
 * - Disputed product rules (all-WILD board, scatter-without-cluster) are selectable through
 *   `InfernoConfig.rules`; the default keeps the original behaviour (`INFERNO_LEGACY_RULES`).
 * - `resolveInfernoSpin()` produces an authoritative presentation script (before/after snapshots,
 *   winning coordinates and old→new cell moves) so the renderer never decides outcomes.
 * - A pure session ledger (`beginInfernoSpin` …) settles every round exactly once, never debits an
 *   awarded free spin, and keeps the stake fixed over a free-spin award cycle.
 * - `simulateInfernoRTP()` now carries heat / free spins between rounds and counts paid stakes only.
 */

import { ProvablyFairRNG, createRNG } from '../shared/rng/ProvablyFairRNG';

// --- Constants ---
const GRID_ROWS = 3;
const GRID_COLS = 3;
const MIN_CLUSTER_SIZE = 3;
const MAX_HEAT_METER = 5;
const FREE_SPINS_AWARDED = 5;
const CROWN_FLIP_WIN_PROBABILITY = 0.5; // 50% chance to win
/** Safety cap on cascades inside one spin. Hitting it marks the spin `unresolved` (never silently zero). */
const MAX_CASCADES_PER_SPIN = 200;
/** Ledger unit: 1 credit = 1000 milli-credits. Bet × base payout × multiplier is exact at 3 decimals. */
const MILLI_PER_CREDIT = 1000;
/** Symbol whose base payout is used when a WILD-only group pays under the `pays-as-top-symbol` rule. */
const TOP_PAYING_SYMBOL: InfernoSymbol = 'EMBER';
/** Version label for the mathematics implemented in this file. Bump whenever returns can change. */
export const INFERNO_MATH_VERSION = 'inferno-math-2';

// Symbol weights for random generation
const SYMBOL_WEIGHTS: { value: InfernoSymbol; weight: number }[] = [
  { value: 'EMBER', weight: 1 },
  { value: 'FLAME', weight: 2 },
  { value: 'COAL', weight: 3 },
  { value: 'ASH', weight: 4 },
  { value: 'SMOKE', weight: 5 },
  { value: 'WILD', weight: 1 },
  { value: 'SCATTER', weight: 1 },
];

// Base multipliers per symbol (applied to bet)
// Base payouts calibrated for ~96% RTP on a 3x3 grid with weighted symbols.
// These are applied as: payout = bet * basePayout * clusterMultiplier
// Symbol weights: EMBER:1, FLAME:2, COAL:3, ASH:4, SMOKE:5, WILD:1, SCATTER:1 (total 17)
// Expected frequency of 3-match cluster is low, so payouts can be moderate.
const SYMBOL_BASE_PAYOUTS: Record<InfernoSymbol, number> = {
  EMBER:   0.8,
  FLAME:   0.5,
  COAL:    0.35,
  ASH:     0.25,
  SMOKE:   0.15,
  WILD:    0,   // WILD payout determined by substituted symbol
  SCATTER: 0,   // SCATTER awards free spins, not direct payout
};

// Cluster size multipliers — keep modest to preserve RTP target
const CLUSTER_MULTIPLIERS: Record<number, number> = {
  3: 1,
  4: 2.5,
  5: 5,
  6: 8,
  7: 12,
  8: 18,
  9: 25,   // Full board — rare jackpot
};

// --- Types ---
export type InfernoSymbol = 'EMBER' | 'FLAME' | 'COAL' | 'ASH' | 'SMOKE' | 'WILD' | 'SCATTER';

export interface InfernoCell {
  symbol: InfernoSymbol;
  row: number;
  col: number;
  /** True if this cell is part of a winning cluster this cascade. */
  isWinning: boolean;
  /** True if this cell was just replaced by cascade (for UI animation). */
  isFalling: boolean;
}

export interface InfernoCluster {
  symbol: InfernoSymbol;
  cells: { row: number; col: number }[];
  payout: number;
}

export interface InfernoState {
  bet: number;
  grid: InfernoCell[][]; // [row][col], 3x3
  heatMeter: number; // 0–5
  totalWin: number; // win for current spin (accumulated across cascades)
  cascadeCount: number; // cascades so far this spin
  clusters: InfernoCluster[]; // winning clusters this cascade
  isInfernoSpin: boolean; // true = this spin all symbols are wild
  isInCrownFlip: boolean;
  crownFlipWin: number; // current crown flip pot
  crownFlipChain: number; // how many flips taken
  freeSpinsRemaining: number;
  scatterCount: number;
  isFreeSpinTriggered: boolean; // True if free spins were just awarded
  isComplete: boolean; // spin fully resolved (no more cascades pending)
  lastSpinSeed: string;

  /**
   * Cascade index that was last credited by `evaluateClusters()`. Used to make repeated evaluation
   * of the same step idempotent. Optional so existing literal states remain valid.
   */
  lastEvaluatedCascade?: number;
}

/**
 * Product rules that the original source left ambiguous. Defaults (`INFERNO_LEGACY_RULES`) reproduce
 * the original behaviour exactly; alternatives exist only so their consequences can be measured.
 */
export interface InfernoRules {
  /**
   * `no-pay` (original): WILD cells never start a cluster, so an all-WILD Inferno Spin returns 0.
   * `pays-as-top-symbol` (proposal): a connected WILD-only group of 3+ that is not part of a paying
   * symbol cluster pays as the top symbol (EMBER) at its size multiplier.
   */
  wildOnlyCluster: 'no-pay' | 'pays-as-top-symbol';
  /**
   * `after-cascade-only` (original): scatters are only checked after a cascade refill, so 3+ scatters
   * on a board without a paying cluster award nothing.
   * `any-landed-board` (proposal): 3+ scatters visible on the landed board or after any refill award
   * free spins once per spin.
   */
  scatterAward: 'after-cascade-only' | 'any-landed-board';
}

/** Original behaviour for the disputed rules. This is the production default. */
export const INFERNO_LEGACY_RULES: Readonly<InfernoRules> = Object.freeze({
  wildOnlyCluster: 'no-pay',
  scatterAward: 'after-cascade-only',
});

export interface InfernoConfig {
  rng?: ProvablyFairRNG;
  /** Optional rule overrides; omitted fields fall back to `INFERNO_LEGACY_RULES`. */
  rules?: Partial<InfernoRules>;
}

/**
 * Resolves the effective rules for a config.
 * @param config Optional Inferno config.
 * @returns Complete rule set (legacy defaults for omitted fields).
 * @example
 * resolveInfernoRules({ rules: { scatterAward: 'any-landed-board' } }).wildOnlyCluster; // 'no-pay'
 */
export function resolveInfernoRules(config?: InfernoConfig): InfernoRules {
  return { ...INFERNO_LEGACY_RULES, ...(config?.rules ?? {}) };
}

/**
 * Creates the initial state for the Inferno game.
 *
 * @param bet The initial bet amount for the game.
 * @returns An `InfernoState` object initialized to its starting values.
 * @example
 * const initialState = createInfernoState(10);
 * console.log(initialState.bet); // 10
 */
export function createInfernoState(bet: number): InfernoState {
  const initialGrid: InfernoCell[][] = Array(GRID_ROWS)
    .fill(null)
    .map((_, r) =>
      Array(GRID_COLS)
        .fill(null)
        .map((_, c) => ({ symbol: 'SMOKE', row: r, col: c, isWinning: false, isFalling: false })),
    );

  return {
    bet,
    grid: initialGrid,
    heatMeter: 0,
    totalWin: 0,
    cascadeCount: 0,
    clusters: [],
    isInfernoSpin: false,
    isInCrownFlip: false,
    crownFlipWin: 0,
    crownFlipChain: 0,
    freeSpinsRemaining: 0,
    scatterCount: 0,
    isFreeSpinTriggered: false,
    isComplete: false,
    lastSpinSeed: '',
  };
}

/**
 * Starts a new spin for the Inferno game.
 * Fills the grid with random symbols, or all WILDs if an Inferno Spin is active.
 * Resets spin-specific state variables.
 *
 * @param state The current `InfernoState`.
 * @param config Optional configuration, including a `ProvablyFairRNG` instance.
 * @returns A new `InfernoState` object representing the start of the spin.
 * @example
 * let state = createInfernoState(10);
 * state = spinInferno(state);
 * console.log(state.grid); // Grid filled with symbols
 */
export function spinInferno(state: InfernoState, config?: InfernoConfig): InfernoState {
  const rng = config?.rng || createRNG();
  const newSeed = rng.getSeed(); // Capture seed for this spin

  const newState: InfernoState = {
    ...state,
    totalWin: 0,
    cascadeCount: 0,
    clusters: [],
    isInCrownFlip: false,
    crownFlipWin: 0,
    crownFlipChain: 0,
    scatterCount: 0,
    isFreeSpinTriggered: false,
    isComplete: false,
    lastSpinSeed: newSeed,
    lastEvaluatedCascade: undefined,
  };

  // Check if this spin should be an Inferno Spin
  const triggerInfernoSpin = newState.heatMeter === MAX_HEAT_METER;
  newState.isInfernoSpin = triggerInfernoSpin;

  // If Inferno Spin, reset heat meter
  if (triggerInfernoSpin) {
    newState.heatMeter = 0;
  }

  // Handle free spins
  if (newState.freeSpinsRemaining > 0) {
    newState.freeSpinsRemaining--;
  }

  const newGrid: InfernoCell[][] = Array(GRID_ROWS)
    .fill(null)
    .map((_, r) =>
      Array(GRID_COLS)
        .fill(null)
        .map((_, c) => {
          const symbol: InfernoSymbol = newState.isInfernoSpin
            ? 'WILD'
            : rng.weightedChoice(SYMBOL_WEIGHTS);
          return { symbol, row: r, col: c, isWinning: false, isFalling: false };
        }),
    );

  newState.grid = newGrid;
  return newState;
}

/**
 * Evaluates the current grid for winning clusters.
 * Marks winning cells and calculates payouts.
 *
 * Idempotent per cascade step: evaluating the same step twice re-derives the clusters but credits
 * `totalWin` only once (tracked by `lastEvaluatedCascade`).
 *
 * @param state The current `InfernoState`.
 * @param config Optional config; only `rules.wildOnlyCluster` is read here.
 * @returns A new `InfernoState` object with updated clusters, totalWin, and marked winning cells.
 * @example
 * let state = createInfernoState(10);
 * state.grid[0][0].symbol = 'EMBER';
 * state.grid[0][1].symbol = 'EMBER';
 * state.grid[0][2].symbol = 'EMBER';
 * state = evaluateClusters(state);
 * console.log(state.clusters.length); // 1
 */
export function evaluateClusters(state: InfernoState, config?: InfernoConfig): InfernoState {
  const rules = resolveInfernoRules(config);
  const newState: InfernoState = { ...state, clusters: [] as InfernoCluster[], scatterCount: 0 };
  const grid = newState.grid.map((row) =>
    row.map((cell) => ({ ...cell, isWinning: false, isFalling: false })),
  ); // Reset isWinning for new evaluation
  const visited: boolean[][] = Array(GRID_ROWS)
    .fill(null)
    .map(() => Array(GRID_COLS).fill(false));

  let currentTotalWin = 0;
  let currentScatterCount = 0;

  // Helper to get neighbors
  const getNeighbors = (r: number, c: number): { row: number; col: number }[] => {
    const neighbors: { row: number; col: number }[] = [];
    if (r > 0) neighbors.push({ row: r - 1, col: c });
    if (r < GRID_ROWS - 1) neighbors.push({ row: r + 1, col: c });
    if (c > 0) neighbors.push({ row: r, col: c - 1 });
    if (c < GRID_COLS - 1) neighbors.push({ row: r, col: c + 1 });
    return neighbors;
  };

  // Check for SCATTER symbols
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      if (grid[r][c].symbol === 'SCATTER') {
        currentScatterCount++;
      }
    }
  }
  newState.scatterCount = currentScatterCount;

  // Cluster detection (BFS)
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      if (visited[r][c] || grid[r][c].symbol === 'SCATTER') {
        continue;
      }

      const startSymbol = grid[r][c].symbol;
      if (startSymbol === 'WILD') {
        // WILDs are handled by matching other symbols, not forming clusters themselves initially
        continue;
      }

      const queue: { row: number; col: number }[] = [{ row: r, col: c }];
      const currentClusterCells: { row: number; col: number }[] = [];
      const tempVisited: boolean[][] = Array(GRID_ROWS)
        .fill(null)
        .map(() => Array(GRID_COLS).fill(false)); // For current BFS path

      tempVisited[r][c] = true;
      visited[r][c] = true; // Mark as visited for main loop
      currentClusterCells.push({ row: r, col: c });

      let head = 0;
      while (head < queue.length) {
        const { row: currR, col: currC } = queue[head++];

        for (const neighbor of getNeighbors(currR, currC)) {
          const { row: nR, col: nC } = neighbor;
          if (!tempVisited[nR][nC]) {
            const neighborSymbol = grid[nR][nC].symbol;

            if (
              neighborSymbol === startSymbol ||
              neighborSymbol === 'WILD' // WILD matches the start symbol
            ) {
              tempVisited[nR][nC] = true;
              visited[nR][nC] = true; // Mark as visited for main loop
              queue.push(neighbor);
              currentClusterCells.push(neighbor);
            }
          }
        }
      }

      if (currentClusterCells.length >= MIN_CLUSTER_SIZE) {
        // Calculate payout for this cluster
        const clusterSize = currentClusterCells.length;
        const basePayout = SYMBOL_BASE_PAYOUTS[startSymbol];
        const clusterMultiplier = CLUSTER_MULTIPLIERS[clusterSize] || CLUSTER_MULTIPLIERS[9]; // Use max multiplier if size exceeds defined

        const payout = state.bet * basePayout * clusterMultiplier;
        currentTotalWin += payout;

        newState.clusters.push({
          symbol: startSymbol,
          cells: currentClusterCells,
          payout,
        });

        // Mark cells as winning
        currentClusterCells.forEach(({ row: cellR, col: cellC }) => {
          grid[cellR][cellC].isWinning = true;
        });
      }
    }
  }

  // Optional rule: WILD-only connected groups (not already part of a paying symbol cluster).
  if (rules.wildOnlyCluster === 'pays-as-top-symbol') {
    const seen: boolean[][] = Array(GRID_ROWS).fill(null).map(() => Array(GRID_COLS).fill(false));
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        if (seen[r][c] || grid[r][c].symbol !== 'WILD' || grid[r][c].isWinning) continue;
        const group: { row: number; col: number }[] = [];
        const queue = [{ row: r, col: c }];
        seen[r][c] = true;
        while (queue.length > 0) {
          const cell = queue.shift() as { row: number; col: number };
          group.push(cell);
          for (const n of getNeighbors(cell.row, cell.col)) {
            if (!seen[n.row][n.col] && grid[n.row][n.col].symbol === 'WILD' && !grid[n.row][n.col].isWinning) {
              seen[n.row][n.col] = true;
              queue.push(n);
            }
          }
        }
        if (group.length >= MIN_CLUSTER_SIZE) {
          const multiplier = CLUSTER_MULTIPLIERS[group.length] || CLUSTER_MULTIPLIERS[9];
          const payout = state.bet * SYMBOL_BASE_PAYOUTS[TOP_PAYING_SYMBOL] * multiplier;
          currentTotalWin += payout;
          newState.clusters.push({ symbol: 'WILD', cells: group, payout });
          group.forEach(({ row, col }) => { grid[row][col].isWinning = true; });
        }
      }
    }
  }

  newState.grid = grid;
  const alreadyCredited = state.lastEvaluatedCascade === state.cascadeCount;
  if (!alreadyCredited) {
    newState.totalWin += currentTotalWin; // Accumulate win for this cascade (once per step)
    newState.lastEvaluatedCascade = state.cascadeCount;
  }
  return newState;
}

/**
 * Removes winning cells from the grid and drops new symbols from above (cascade step).
 * Increments cascadeCount and Heat Meter.
 *
 * @param state The current `InfernoState` after cluster evaluation.
 * @param config Optional configuration, including a `ProvablyFairRNG` instance.
 * @returns A new `InfernoState` object with the cascaded grid and updated counts.
 * @example
 * let state = createInfernoState(10);
 * state = spinInferno(state);
 * state = evaluateClusters(state); // Assume clusters are found
 * state = cascadeInferno(state);
 * console.log(state.cascadeCount); // 1
 */
export function cascadeInferno(state: InfernoState, config?: InfernoConfig): InfernoState {
  if (state.clusters.length === 0) {
    // No clusters, no cascade, spin is complete.
    const completed: InfernoState = { ...state, isComplete: true };
    if (resolveInfernoRules(config).scatterAward === 'any-landed-board') {
      return applyScatterAward(completed);
    }
    return completed;
  }

  const rng = config?.rng || createRNG(state.lastSpinSeed); // Use same seed for consistency within a spin
  const newState = { ...state };

  newState.cascadeCount++;

  // Increment heat meter only if it's not an Inferno Spin and not already at max
  if (!newState.isInfernoSpin && newState.heatMeter < MAX_HEAT_METER) {
    newState.heatMeter++;
  }

  const newGrid: InfernoCell[][] = Array(GRID_ROWS)
    .fill(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- placeholder; every cell is assigned below
    .map(() => Array(GRID_COLS).fill(null as any)); // Will be filled

  // For each column, collect non-winning symbols and fill new ones
  for (let col = 0; col < GRID_COLS; col++) {
    // Survivors are collected top-to-bottom so gravity preserves their relative order.
    // (The original loop ran bottom-to-top and reversed each column — inferno-math-1 defect.)
    const nonWinningSymbols: InfernoSymbol[] = [];
    for (let row = 0; row < GRID_ROWS; row++) {
      if (!state.grid[row][col].isWinning) {
        nonWinningSymbols.push(state.grid[row][col].symbol);
      }
    }

    const numNewSymbols = GRID_ROWS - nonWinningSymbols.length;
    const generatedSymbols: InfernoSymbol[] = [];
    for (let i = 0; i < numNewSymbols; i++) {
      generatedSymbols.push(rng.weightedChoice(SYMBOL_WEIGHTS));
    }

    // Fill the new column: new symbols on top, then existing non-winning symbols
    const columnSymbols = [...generatedSymbols, ...nonWinningSymbols];

    for (let row = 0; row < GRID_ROWS; row++) {
      const symbol = columnSymbols[row];
      const isFalling = row < numNewSymbols; // New symbols are falling
      newGrid[row][col] = { symbol, row, col, isWinning: false, isFalling };
    }
  }

  newState.grid = newGrid;
  newState.clusters = state.clusters; // keep the removed clusters for presentation of this step
  return applyScatterAward(newState);
}

/**
 * Counts scatters on the current grid and, if 3+ and not yet awarded this spin, awards free spins.
 * @param state State whose grid should be checked.
 * @returns New state with updated `scatterCount`, `isFreeSpinTriggered` and `freeSpinsRemaining`.
 */
function applyScatterAward(state: InfernoState): InfernoState {
  const newState = { ...state };
  let currentScatterCount = 0;
  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      if (newState.grid[r][c].symbol === 'SCATTER') {
        currentScatterCount++;
      }
    }
  }
  newState.scatterCount = currentScatterCount;

  // Free spin trigger (scatter threshold shares MIN_CLUSTER_SIZE = 3 in the original source)
  if (newState.scatterCount >= MIN_CLUSTER_SIZE && !newState.isFreeSpinTriggered) {
    newState.isFreeSpinTriggered = true;
    newState.freeSpinsRemaining += FREE_SPINS_AWARDED;
  }
  return newState;
}

/**
 * Attempts a Crown Flip. A 50/50 chance to double the current `crownFlipWin` or lose it all.
 *
 * @param state The current `InfernoState`.
 * @param config Optional configuration, including a `ProvablyFairRNG` instance.
 * @returns A new `InfernoState` object with the updated `crownFlipWin` and `crownFlipChain`.
 * @example
 * let state = createInfernoState(10);
 * state.totalWin = 100;
 * state.isInCrownFlip = true;
 * state.crownFlipWin = 100;
 * const rng = createRNG('win'); // Seed for guaranteed win
 * state = flipCrown(state, { rng });
 * console.log(state.crownFlipWin); // 200
 */
export function flipCrown(state: InfernoState, config?: InfernoConfig): InfernoState {
  if (!state.isInCrownFlip) {
    return state; // Cannot flip if not in Crown Flip mode
  }

  const rng = config?.rng || createRNG(state.lastSpinSeed);
  const newState = { ...state };

  if (rng.random() < CROWN_FLIP_WIN_PROBABILITY) {
    // Win
    newState.crownFlipWin *= 2;
    newState.crownFlipChain++;
  } else {
    // Lose
    newState.crownFlipWin = 0;
    newState.isInCrownFlip = false;
    newState.isComplete = true; // Lost the flip, spin is complete
  }

  return newState;
}

/**
 * Player decides to walk away from the Crown Flip.
 * The current `crownFlipWin` is accepted as the final `totalWin` for the spin.
 *
 * @param state The current `InfernoState`.
 * @returns A new `InfernoState` object with the `totalWin` finalized and Crown Flip mode exited.
 * @example
 * let state = createInfernoState(10);
 * state.totalWin = 100;
 * state.isInCrownFlip = true;
 * state.crownFlipWin = 200; // After a successful flip
 * state = walkCrown(state);
 * console.log(state.totalWin); // 200
 * console.log(state.isInCrownFlip); // false
 */
export function walkCrown(state: InfernoState): InfernoState {
  if (!state.isInCrownFlip) {
    return state; // Cannot walk if not in Crown Flip mode
  }

  const newState = { ...state };
  newState.totalWin = newState.crownFlipWin;
  newState.isInCrownFlip = false;
  newState.isComplete = true; // Walked away, spin is complete

  return newState;
}

// ═══════════════════════════════════════════════════════════════════════════
// Authoritative spin script (presentation data; the renderer never decides outcomes)
// ═══════════════════════════════════════════════════════════════════════════

/** A cell position on the 3×3 board. */
export interface InfernoCellRef {
  row: number;
  col: number;
}

/** A surviving symbol moving down after removal (row indices are [0..2], top = 0). */
export interface InfernoCellMove {
  col: number;
  fromRow: number;
  toRow: number;
  symbol: InfernoSymbol;
}

/** A new symbol dropping in from above. `slotsAbove` = 1 for the lowest new symbol in its column. */
export interface InfernoRefill {
  col: number;
  toRow: number;
  slotsAbove: number;
  symbol: InfernoSymbol;
}

/** One win → remove → fall step, with separate before/after snapshots. */
export interface InfernoCascadeStep {
  index: number;
  /** Board before removal, `[row][col]`. Winning coordinates refer to this board. */
  gridBefore: InfernoSymbol[][];
  clusters: InfernoCluster[];
  /** Union of all winning cells (a WILD shared by two clusters appears once). */
  winningCells: InfernoCellRef[];
  stepWin: number;
  totalWinAfter: number;
  moves: InfernoCellMove[];
  refills: InfernoRefill[];
  /** Board after refill, `[row][col]`. */
  gridAfter: InfernoSymbol[][];
  heatBefore: number;
  heatAfter: number;
  scatterCountAfter: number;
  freeSpinsAwarded: number;
}

/** Complete, pre-computed result of one spin (base or free). */
export interface InfernoSpinScript {
  mathVersion: string;
  rules: InfernoRules;
  stake: number;
  isFreeSpin: boolean;
  isInfernoSpin: boolean;
  heatBefore: number;
  /** Heat after the spin start (an Inferno Spin resets heat to 0 before landing). */
  heatAtLanding: number;
  initialGrid: InfernoSymbol[][];
  steps: InfernoCascadeStep[];
  /** Free spins awarded when the board landed without a cascade (`any-landed-board` rule only). */
  freeSpinsAwardedAtLanding: number;
  totalWin: number;
  freeSpinsAwarded: number;
  freeSpinsRemainingAfter: number;
  /** True if `MAX_CASCADES_PER_SPIN` was hit. Such spins must be reported, never counted as 0. */
  unresolved: boolean;
  /** State after the spin fully resolved (`isComplete: true`, Crown not yet entered). */
  finalState: InfernoState;
}

const snapshotGrid = (state: InfernoState): InfernoSymbol[][] =>
  state.grid.map((row) => row.map((cell) => cell.symbol));

/**
 * Computes the old→new mapping for a cascade from the pre-removal board and the post-refill board.
 * Survivors keep top-to-bottom order; refills occupy the top rows.
 */
function mapCascade(
  before: InfernoState,
  after: InfernoState,
): { moves: InfernoCellMove[]; refills: InfernoRefill[] } {
  const moves: InfernoCellMove[] = [];
  const refills: InfernoRefill[] = [];
  for (let col = 0; col < GRID_COLS; col++) {
    const survivors: number[] = [];
    for (let row = 0; row < GRID_ROWS; row++) {
      if (!before.grid[row][col].isWinning) survivors.push(row);
    }
    const newCount = GRID_ROWS - survivors.length;
    survivors.forEach((fromRow, k) => {
      moves.push({ col, fromRow, toRow: newCount + k, symbol: before.grid[fromRow][col].symbol });
    });
    for (let toRow = 0; toRow < newCount; toRow++) {
      refills.push({ col, toRow, slotsAbove: newCount - toRow, symbol: after.grid[toRow][col].symbol });
    }
  }
  return { moves, refills };
}

/**
 * Resolves all cascades from an already-landed board. Used by `resolveInfernoSpin()` and by
 * developer fixtures (which supply a landed board) — both run the same production functions.
 *
 * @param landed State whose grid has just landed (as returned by `spinInferno()`).
 * @param config Config with the RNG used for refills and optional rules.
 * @returns Steps, completed state and an `unresolved` flag.
 * @example
 * const { steps, finalState } = resolveInfernoCascades(spinInferno(state, { rng }), { rng });
 */
export function resolveInfernoCascades(
  landed: InfernoState,
  config?: InfernoConfig,
): { steps: InfernoCascadeStep[]; finalState: InfernoState; unresolved: boolean; freeSpinsAwardedAtLanding: number } {
  const steps: InfernoCascadeStep[] = [];
  let state = landed;
  let unresolved = false;
  let freeSpinsAwardedAtLanding = 0;
  for (;;) {
    const evaluated = evaluateClusters(state, config);
    if (evaluated.clusters.length === 0) {
      const freeBefore = evaluated.freeSpinsRemaining;
      state = cascadeInferno(evaluated, config); // completes the spin (and may apply scatter rule)
      if (steps.length === 0) freeSpinsAwardedAtLanding = state.freeSpinsRemaining - freeBefore;
      else if (state.freeSpinsRemaining > freeBefore) steps[steps.length - 1].freeSpinsAwarded += state.freeSpinsRemaining - freeBefore;
      break;
    }
    if (steps.length >= MAX_CASCADES_PER_SPIN) {
      unresolved = true;
      state = { ...evaluated, isComplete: true };
      break;
    }
    const after = cascadeInferno(evaluated, config);
    const { moves, refills } = mapCascade(evaluated, after);
    const winningCells: InfernoCellRef[] = [];
    evaluated.grid.forEach((row, r) => row.forEach((cell, c) => { if (cell.isWinning) winningCells.push({ row: r, col: c }); }));
    steps.push({
      index: steps.length,
      gridBefore: snapshotGrid(evaluated),
      clusters: evaluated.clusters.map((cl) => ({ ...cl, cells: cl.cells.map((p) => ({ ...p })) })),
      winningCells,
      stepWin: evaluated.totalWin - state.totalWin,
      totalWinAfter: evaluated.totalWin,
      moves,
      refills,
      gridAfter: snapshotGrid(after),
      heatBefore: evaluated.heatMeter,
      heatAfter: after.heatMeter,
      scatterCountAfter: after.scatterCount,
      freeSpinsAwarded: after.freeSpinsRemaining - evaluated.freeSpinsRemaining,
    });
    state = after;
  }
  return { steps, finalState: { ...state, clusters: [], isComplete: true }, unresolved, freeSpinsAwardedAtLanding };
}

/**
 * Runs one complete spin (start → land → every cascade) using the production functions and returns
 * an authoritative script for presentation. All RNG consumption for the spin happens here, so
 * animation speed, skip, reduced motion or audio settings cannot change the outcome.
 *
 * @param state State before the spin (heat / free spins carried from the previous spin).
 * @param config Config with the gameplay RNG and optional rules.
 * @returns Complete spin script.
 * @example
 * const script = resolveInfernoSpin(createInfernoState(10), { rng: createRNG('seed') });
 * console.log(script.totalWin, script.steps.length);
 */
export function resolveInfernoSpin(state: InfernoState, config?: InfernoConfig): InfernoSpinScript {
  const rules = resolveInfernoRules(config);
  const isFreeSpin = state.freeSpinsRemaining > 0;
  const landed = spinInferno(state, config);
  const freeAfterStart = landed.freeSpinsRemaining;
  const { steps, finalState, unresolved, freeSpinsAwardedAtLanding } = resolveInfernoCascades(landed, config);
  return {
    mathVersion: INFERNO_MATH_VERSION,
    rules,
    stake: state.bet,
    isFreeSpin,
    isInfernoSpin: landed.isInfernoSpin,
    heatBefore: state.heatMeter,
    heatAtLanding: landed.heatMeter,
    initialGrid: snapshotGrid(landed),
    steps,
    freeSpinsAwardedAtLanding,
    totalWin: finalState.totalWin,
    freeSpinsAwarded: finalState.freeSpinsRemaining - freeAfterStart,
    freeSpinsRemainingAfter: finalState.freeSpinsRemaining,
    unresolved,
    finalState,
  };
}

/**
 * Crown Flip eligibility (unchanged from the original scene rule): a positive spin return and no
 * free spins pending. During a free-spin cycle Crown is therefore offered only on the last spin.
 *
 * @param state Completed spin state.
 * @returns True if the player may choose to gamble the spin's return.
 * @example
 * if (isCrownEligible(script.finalState)) showCrownDecision();
 */
export function isCrownEligible(state: InfernoState): boolean {
  return state.isComplete && state.totalWin > 0 && state.freeSpinsRemaining === 0;
}

/**
 * Enters Crown Flip with the spin's return as the amount at risk.
 * @param state Completed, eligible spin state.
 * @returns State with `isInCrownFlip` set, or the input unchanged when not eligible.
 * @example
 * state = enterCrownFlip(script.finalState);
 */
export function enterCrownFlip(state: InfernoState): InfernoState {
  if (!isCrownEligible(state)) return state;
  return { ...state, isInCrownFlip: true, isComplete: false, crownFlipWin: state.totalWin, crownFlipChain: 0 };
}

// ═══════════════════════════════════════════════════════════════════════════
// Session ledger — exactly-once debit/credit guarded by round ID and phase
// ═══════════════════════════════════════════════════════════════════════════

/** Explicit round phases. Presentation sub-phases (spinning/removing/falling) live in the UI. */
export type InfernoPhase = 'ready' | 'presenting' | 'decision' | 'settled';

/** One ledger movement in milli-credits. */
export interface InfernoLedgerEntry {
  roundId: number;
  cycleId: number;
  kind: 'debit' | 'credit';
  amountMilli: number;
}

/** A paid spin plus every free spin it awarded (including retriggers) and any Crown decision. */
export interface InfernoCycle {
  id: number;
  stake: number;
  paidStakeMilli: number;
  returnedMilli: number;
  spins: number;
  freeSpins: number;
}

/** Demo-credit session. Balances are integer milli-credits to avoid float drift. */
export interface InfernoSession {
  balanceMilli: number;
  /** Stake selected for the next paid spin. Locked while a cycle is open. */
  selectedStake: number;
  phase: InfernoPhase;
  roundId: number;
  state: InfernoState;
  cycle: InfernoCycle | null;
  lastCycle: InfernoCycle | null;
  nextCycleId: number;
  /** Bounded history (most recent `LEDGER_HISTORY` entries). */
  ledger: InfernoLedgerEntry[];
  debitCount: number;
  creditCount: number;
}

/** Result of a session action. `rejected` actions leave the session unchanged. */
export interface InfernoActionResult {
  session: InfernoSession;
  rejected?: 'BUSY' | 'INSUFFICIENT_BALANCE' | 'STALE_ROUND' | 'WRONG_PHASE' | 'STAKE_LOCKED';
  script?: InfernoSpinScript;
  /** Present when the action settled a round. */
  settlement?: InfernoSettlement;
}

/** What was credited when a round settled, plus cycle-level totals for honest feedback. */
export interface InfernoSettlement {
  roundId: number;
  creditedMilli: number;
  /** True when no free spins remain: the paid cycle is closed. */
  cycleComplete: boolean;
  cyclePaidMilli: number;
  cycleReturnedMilli: number;
  /** Return relative to the cycle's paid stake: only `profit` may use a positive motif. */
  cycleOutcome: 'pending' | 'zero' | 'partial' | 'break-even' | 'profit';
}

const LEDGER_HISTORY = 64;

/**
 * Converts credits to integer milli-credits (rounding away binary float error, e.g. 1.0499999).
 * @param credits Amount in credits.
 * @returns Integer milli-credits.
 * @example
 * toMilliCredits(1.05); // 1050
 */
export function toMilliCredits(credits: number): number {
  return Math.round(credits * MILLI_PER_CREDIT);
}

/**
 * Formats milli-credits for display with two decimals (display rounding only; ledger stays exact).
 * @param milli Amount in milli-credits.
 * @returns e.g. "1,234.50".
 * @example
 * formatCredits(1050); // "1.05"
 */
export function formatCredits(milli: number): string {
  const value = milli / MILLI_PER_CREDIT;
  return value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Classifies a closed or open cycle for feedback. Profit requires return strictly above paid stake.
 * @param cycle Cycle to classify.
 * @param complete Whether the cycle is closed.
 * @returns Outcome class.
 * @example
 * classifyCycle({ paidStakeMilli: 10000, returnedMilli: 5000 } as InfernoCycle, true); // 'partial'
 */
export function classifyCycle(cycle: Pick<InfernoCycle, 'paidStakeMilli' | 'returnedMilli'>, complete: boolean): InfernoSettlement['cycleOutcome'] {
  if (!complete) return 'pending';
  if (cycle.returnedMilli === 0) return 'zero';
  if (cycle.returnedMilli < cycle.paidStakeMilli) return 'partial';
  if (cycle.returnedMilli === cycle.paidStakeMilli) return 'break-even';
  return 'profit';
}

/** Audio/visual outcome cue chosen for a settlement (presentation policy, pure and testable). */
export type InfernoOutcomeCue = 'none' | 'neutral' | 'profit';

/**
 * Ethical outcome-cue policy: the positive motif plays only when a paid cycle has CLOSED with a
 * gross return strictly above its paid stake. Pending cycles (free spins left), partial returns,
 * break-even and zero returns never get a celebratory cue.
 *
 * @param settlement Settlement returned by the ledger.
 * @returns Cue to play.
 * @example
 * selectInfernoOutcomeCue(res.settlement); // 'profit' | 'neutral' | 'none'
 */
export function selectInfernoOutcomeCue(settlement: InfernoSettlement): InfernoOutcomeCue {
  if (!settlement.cycleComplete) return 'none';
  return settlement.cycleOutcome === 'profit' ? 'profit' : 'neutral';
}

const pushLedger = (session: InfernoSession, entry: InfernoLedgerEntry): InfernoLedgerEntry[] => {
  const next = session.ledger.concat(entry);
  return next.length > LEDGER_HISTORY ? next.slice(next.length - LEDGER_HISTORY) : next;
};

/**
 * Creates a demo-credit session.
 * @param balanceCredits Starting demo balance in credits.
 * @param stake Initial selected stake in credits.
 * @returns New session in the `ready` phase.
 * @example
 * const session = createInfernoSession(1000, 10);
 */
export function createInfernoSession(balanceCredits: number, stake: number): InfernoSession {
  return {
    balanceMilli: toMilliCredits(balanceCredits),
    selectedStake: stake,
    phase: 'ready',
    roundId: 0,
    state: { ...createInfernoState(stake), isComplete: true },
    cycle: null,
    lastCycle: null,
    nextCycleId: 1,
    ledger: [],
    debitCount: 0,
    creditCount: 0,
  };
}

/**
 * True when the next spin is an awarded free spin (no debit, stake fixed to the cycle stake).
 * @param session Current session.
 * @returns Whether the next spin is free.
 * @example
 * if (isNextSpinFree(session)) label = 'FREE SPIN';
 */
export function isNextSpinFree(session: InfernoSession): boolean {
  return session.state.freeSpinsRemaining > 0;
}

/**
 * Changes the selected stake. Rejected while a round or award cycle is open.
 * @param session Current session.
 * @param stake New stake in credits.
 * @returns Action result.
 * @example
 * session = setInfernoStake(session, 25).session;
 */
export function setInfernoStake(session: InfernoSession, stake: number): InfernoActionResult {
  if (session.phase !== 'ready' || session.cycle !== null) return { session, rejected: 'STAKE_LOCKED' };
  return { session: { ...session, selectedStake: stake, state: { ...session.state, bet: stake } } };
}

/**
 * Starts a spin. A paid spin debits the selected stake exactly once and opens a cycle; an awarded
 * free spin debits nothing, needs no balance, and uses the cycle's stake. The full outcome is
 * resolved immediately and returned as a script.
 *
 * @param session Current session (must be `ready`).
 * @param config Config with the gameplay RNG and optional rules.
 * @returns Action result with the new session (phase `presenting`, new round ID) and script.
 * @example
 * const { session: next, script, rejected } = beginInfernoSpin(session, { rng });
 */
export function beginInfernoSpin(session: InfernoSession, config?: InfernoConfig): InfernoActionResult {
  if (session.phase !== 'ready') return { session, rejected: 'BUSY' };
  const free = isNextSpinFree(session);
  const roundId = session.roundId + 1;
  let balanceMilli = session.balanceMilli;
  let ledger = session.ledger;
  let debitCount = session.debitCount;
  let cycle: InfernoCycle;
  let nextCycleId = session.nextCycleId;

  if (free && session.cycle) {
    cycle = { ...session.cycle, spins: session.cycle.spins + 1, freeSpins: session.cycle.freeSpins + 1 };
  } else {
    const stakeMilli = toMilliCredits(session.selectedStake);
    if (balanceMilli < stakeMilli) return { session, rejected: 'INSUFFICIENT_BALANCE' };
    balanceMilli -= stakeMilli;
    cycle = { id: nextCycleId, stake: session.selectedStake, paidStakeMilli: stakeMilli, returnedMilli: 0, spins: 1, freeSpins: 0 };
    nextCycleId += 1;
    ledger = pushLedger(session, { roundId, cycleId: cycle.id, kind: 'debit', amountMilli: stakeMilli });
    debitCount += 1;
  }

  const startState: InfernoState = { ...session.state, bet: cycle.stake, isInCrownFlip: false };
  const script = resolveInfernoSpin(startState, config);
  return {
    session: { ...session, balanceMilli, ledger, debitCount, cycle, nextCycleId, roundId, phase: 'presenting', state: script.finalState },
    script,
  };
}

/**
 * Settles `amountMilli` for the current round and closes the cycle when no free spins remain.
 */
function settleRound(session: InfernoSession, state: InfernoState, amountMilli: number): InfernoActionResult {
  const cycle = session.cycle as InfernoCycle;
  const updatedCycle: InfernoCycle = { ...cycle, returnedMilli: cycle.returnedMilli + amountMilli };
  const cycleComplete = state.freeSpinsRemaining === 0;
  const settled: InfernoSession = {
    ...session,
    balanceMilli: session.balanceMilli + amountMilli,
    ledger: pushLedger(session, { roundId: session.roundId, cycleId: cycle.id, kind: 'credit', amountMilli }),
    creditCount: session.creditCount + 1,
    phase: 'ready',
    state: { ...state, isInCrownFlip: false, isComplete: true },
    cycle: cycleComplete ? null : updatedCycle,
    lastCycle: updatedCycle,
  };
  return {
    session: settled,
    settlement: {
      roundId: session.roundId,
      creditedMilli: amountMilli,
      cycleComplete,
      cyclePaidMilli: updatedCycle.paidStakeMilli,
      cycleReturnedMilli: updatedCycle.returnedMilli,
      cycleOutcome: classifyCycle(updatedCycle, cycleComplete),
    },
  };
}

/**
 * Called once the presentation of `roundId` has finished. Either enters the Crown decision (when
 * eligible and `offerCrown` is true) or settles the spin's return exactly once.
 *
 * @param session Current session (phase `presenting`).
 * @param roundId Round being finished; stale IDs are rejected.
 * @param offerCrown Whether to offer the optional Crown decision (default true).
 * @returns Action result; `settlement` present if the round settled.
 * @example
 * const res = finishInfernoPresentation(session, roundId);
 */
export function finishInfernoPresentation(session: InfernoSession, roundId: number, offerCrown = true): InfernoActionResult {
  if (roundId !== session.roundId) return { session, rejected: 'STALE_ROUND' };
  if (session.phase !== 'presenting') return { session, rejected: 'WRONG_PHASE' };
  if (offerCrown && isCrownEligible(session.state)) {
    return { session: { ...session, phase: 'decision', state: enterCrownFlip(session.state) } };
  }
  return settleRound(session, session.state, toMilliCredits(session.state.totalWin));
}

/**
 * Player chose FLIP. Resolves one flip; a loss settles 0, a win stays in `decision`.
 * @param session Current session (phase `decision`).
 * @param roundId Round ID from the decision prompt.
 * @param config Config with the gameplay RNG.
 * @returns Action result.
 * @example
 * const res = crownFlipAction(session, roundId, { rng });
 */
export function crownFlipAction(session: InfernoSession, roundId: number, config?: InfernoConfig): InfernoActionResult {
  if (roundId !== session.roundId) return { session, rejected: 'STALE_ROUND' };
  if (session.phase !== 'decision' || !session.state.isInCrownFlip) return { session, rejected: 'WRONG_PHASE' };
  const flipped = flipCrown(session.state, config);
  if (!flipped.isInCrownFlip) {
    return settleRound(session, { ...flipped, totalWin: 0 }, 0);
  }
  return { session: { ...session, state: flipped } };
}

/**
 * Player chose COLLECT. Settles the current Crown amount exactly once.
 * @param session Current session (phase `decision`).
 * @param roundId Round ID from the decision prompt.
 * @returns Action result with settlement.
 * @example
 * const res = crownCollectAction(session, roundId);
 */
export function crownCollectAction(session: InfernoSession, roundId: number): InfernoActionResult {
  if (roundId !== session.roundId) return { session, rejected: 'STALE_ROUND' };
  if (session.phase !== 'decision' || !session.state.isInCrownFlip) return { session, rejected: 'WRONG_PHASE' };
  const walked = walkCrown(session.state);
  return settleRound(session, walked, toMilliCredits(walked.totalWin));
}

// ═══════════════════════════════════════════════════════════════════════════
// Simulation (production functions only)
// ═══════════════════════════════════════════════════════════════════════════

/** Crown policy used by the simulator. It never changes what the game allows a player to do. */
export type InfernoCrownPolicy =
  | { kind: 'collect' }
  | { kind: 'flip-once' }
  /** Flip until `maxFlips` wins or a loss (bounded analysis policy). */
  | { kind: 'flip-up-to'; maxFlips: number };

/** Aggregate statistics from a cycle simulation. */
export interface InfernoSimulationStats {
  mathVersion: string;
  rules: InfernoRules;
  crownPolicy: InfernoCrownPolicy;
  stake: number;
  paidCycles: number;
  paidSpins: number;
  freeSpins: number;
  totalPaidMilli: number;
  grossReturnMilli: number;
  rtp: number;
  /** Cycles returning > 0. */
  hitCycles: number;
  zeroCycles: number;
  partialCycles: number;
  breakEvenCycles: number;
  profitCycles: number;
  infernoSpins: number;
  infernoSpinReturnMilli: number;
  freeSpinAwards: number;
  crownOffers: number;
  crownFlips: number;
  crownFlipWins: number;
  /** cascadeHistogram[k] = spins with exactly k cascades (last bucket = k or more). */
  cascadeHistogram: number[];
  maxCascadesObserved: number;
  maxCycleReturnMilli: number;
  maxSpinReturnMilli: number;
  unresolvedSpins: number;
  nonFiniteEvents: number;
  /** Free spins still pending when the requested number of paid cycles completed (should be 0). */
  pendingFreeSpinsAtEnd: number;
  /** Heat level at the end of the run (state carried across cycles). */
  finalHeat: number;
}

const CASCADE_HISTOGRAM_BUCKETS = 12;

/**
 * Simulates complete paid cycles with persistent heat and free-spin state, using the production
 * functions (`resolveInfernoSpin`, `flipCrown`, `walkCrown`). Only paid stakes enter the RTP
 * denominator; awarded free spins are drained inside their cycle.
 *
 * @param paidCycles Number of paid entries to simulate.
 * @param stake Stake per paid entry.
 * @param config Config with RNG and optional rules.
 * @param crownPolicy Crown decision policy for analysis (default: collect immediately).
 * @param initialState Optional carried state (e.g. heat) to continue from.
 * @returns Aggregate statistics.
 * @example
 * const stats = simulateInfernoCycles(10000, 1, { rng: createRNG('batch-1') });
 * console.log(stats.rtp);
 */
export function simulateInfernoCycles(
  paidCycles: number,
  stake: number,
  config?: InfernoConfig,
  crownPolicy: InfernoCrownPolicy = { kind: 'collect' },
  initialState?: InfernoState,
): InfernoSimulationStats {
  const rng = config?.rng || createRNG();
  const cfg: InfernoConfig = { ...config, rng };
  const stakeMilli = toMilliCredits(stake);
  const stats: InfernoSimulationStats = {
    mathVersion: INFERNO_MATH_VERSION, rules: resolveInfernoRules(cfg), crownPolicy, stake,
    paidCycles: 0, paidSpins: 0, freeSpins: 0, totalPaidMilli: 0, grossReturnMilli: 0, rtp: 0,
    hitCycles: 0, zeroCycles: 0, partialCycles: 0, breakEvenCycles: 0, profitCycles: 0,
    infernoSpins: 0, infernoSpinReturnMilli: 0, freeSpinAwards: 0, crownOffers: 0, crownFlips: 0, crownFlipWins: 0,
    cascadeHistogram: Array(CASCADE_HISTOGRAM_BUCKETS).fill(0), maxCascadesObserved: 0,
    maxCycleReturnMilli: 0, maxSpinReturnMilli: 0, unresolvedSpins: 0, nonFiniteEvents: 0,
    pendingFreeSpinsAtEnd: 0, finalHeat: 0,
  };
  let state: InfernoState = initialState ? { ...initialState, bet: stake } : createInfernoState(stake);

  for (let cycleIndex = 0; cycleIndex < paidCycles; cycleIndex++) {
    stats.paidCycles++;
    stats.totalPaidMilli += stakeMilli;
    let cycleReturn = 0;
    let first = true;
    while (first || state.freeSpinsRemaining > 0) {
      if (first) stats.paidSpins++; else stats.freeSpins++;
      first = false;
      const script = resolveInfernoSpin({ ...state, bet: stake, isInCrownFlip: false }, cfg);
      if (script.isInfernoSpin) { stats.infernoSpins++; stats.infernoSpinReturnMilli += toMilliCredits(script.totalWin); }
      if (script.freeSpinsAwarded > 0) stats.freeSpinAwards++;
      if (script.unresolved) stats.unresolvedSpins++;
      const k = script.steps.length;
      stats.cascadeHistogram[Math.min(k, CASCADE_HISTOGRAM_BUCKETS - 1)]++;
      stats.maxCascadesObserved = Math.max(stats.maxCascadesObserved, k);
      state = script.finalState;

      let spinReturn = state.totalWin;
      if (isCrownEligible(state) && crownPolicy.kind !== 'collect') {
        stats.crownOffers++;
        let crown = enterCrownFlip(state);
        const limit = crownPolicy.kind === 'flip-once' ? 1 : Math.max(0, crownPolicy.maxFlips);
        let flips = 0;
        let lost = false;
        while (crown.isInCrownFlip && flips < limit) {
          crown = flipCrown(crown, cfg);
          flips++;
          stats.crownFlips++;
          if (crown.isInCrownFlip) stats.crownFlipWins++;
          else lost = true; // flipCrown leaves totalWin untouched on a loss; the return is 0
        }
        if (crown.isInCrownFlip) crown = walkCrown(crown);
        spinReturn = lost ? 0 : crown.totalWin;
        state = { ...crown, totalWin: spinReturn, isInCrownFlip: false, isComplete: true };
      } else if (isCrownEligible(state)) {
        stats.crownOffers++;
      }
      if (!Number.isFinite(spinReturn) || !Number.isFinite(state.heatMeter)) stats.nonFiniteEvents++;
      const spinMilli = toMilliCredits(spinReturn);
      stats.maxSpinReturnMilli = Math.max(stats.maxSpinReturnMilli, spinMilli);
      cycleReturn += spinMilli;
    }
    stats.grossReturnMilli += cycleReturn;
    stats.maxCycleReturnMilli = Math.max(stats.maxCycleReturnMilli, cycleReturn);
    const outcome = classifyCycle({ paidStakeMilli: stakeMilli, returnedMilli: cycleReturn }, true);
    if (cycleReturn > 0) stats.hitCycles++;
    if (outcome === 'zero') stats.zeroCycles++;
    else if (outcome === 'partial') stats.partialCycles++;
    else if (outcome === 'break-even') stats.breakEvenCycles++;
    else stats.profitCycles++;
  }
  stats.pendingFreeSpinsAtEnd = state.freeSpinsRemaining;
  stats.finalHeat = state.heatMeter;
  stats.rtp = stats.totalPaidMilli > 0 ? stats.grossReturnMilli / stats.totalPaidMilli : 0;
  return stats;
}

/**
 * Simulates N paid rounds of the Inferno game to estimate its Return To Player (RTP).
 * Revised for inferno-math-2: heat and free spins persist between rounds, awarded free spins are
 * drained inside their paid cycle, only paid stakes are counted, and Crown is collected immediately
 * (a fair 50/50 double-or-nothing does not change expected return, but does change variance).
 *
 * @param rounds The number of paid rounds (cycles) to simulate.
 * @param bet The bet amount for each paid round.
 * @param config Optional configuration, including a `ProvablyFairRNG` instance and rules.
 * @returns The estimated RTP as a decimal (e.g., 0.96 for 96%). This is an estimate, not a proof.
 * @example
 * const estimatedRTP = simulateInfernoRTP(10000, 1);
 * console.log(`Estimated RTP: ${estimatedRTP.toFixed(2)}`);
 */
export function simulateInfernoRTP(rounds: number, bet: number, config?: InfernoConfig): number {
  return simulateInfernoCycles(rounds, bet, config, { kind: 'collect' }).rtp;
}

const MASK64 = (1n << 64n) - 1n;
const FNV64_OFFSET = 0xcbf29ce484222325n;
const FNV64_PRIME = 0x100000001b3n;
const SAFE_INTEGER_BITS = 53n;

/**
 * Derives a well-mixed numeric RNG seed from a string (FNV-1a 64 + splitmix64 finalizer, top 53 bits).
 *
 * Why: the shared ProvablyFairRNG hashes string seeds with an unmasked djb2 and takes the low bits of
 * its first outputs, so seeds that differ only in their last characters (e.g. `session:r1`,
 * `session:r2`) frequently produce IDENTICAL streams (measured: 127 distinct of 500). Passing this
 * numeric seed avoids that without modifying the shared generator.
 *
 * @param key Any string (e.g. `${sessionSeed}:r${roundId}`).
 * @returns Integer in [1, 2^53).
 * @example
 * createRNG(deriveInfernoSeed(`${sessionSeed}:r${roundId}`));
 */
export function deriveInfernoSeed(key: string): number {
  let h = FNV64_OFFSET;
  for (let i = 0; i < key.length; i++) {
    h ^= BigInt(key.charCodeAt(i));
    h = (h * FNV64_PRIME) & MASK64;
  }
  let z = (h + 0x9e3779b97f4a7c15n) & MASK64;
  z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK64;
  z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & MASK64;
  z ^= z >> 31n;
  const top = Number(z >> (64n - SAFE_INTEGER_BITS));
  return top === 0 ? 1 : top;
}

/** Draws discarded after seeding: the shared generator's FIRST output is heavily biased (measured). */
export const INFERNO_RNG_WARMUP_DRAWS = 16;

/**
 * Creates the gameplay RNG for one round: numeric seed via `deriveInfernoSeed(key)`, then
 * `INFERNO_RNG_WARMUP_DRAWS` discarded outputs. Works around two measured properties of the shared
 * ProvablyFairRNG (suffix-only string-seed collisions; biased first output) without modifying it.
 *
 * @param key Round key, e.g. `${sessionSeed}:r${roundId}`.
 * @returns Warmed-up ProvablyFairRNG.
 * @example
 * const rng = createInfernoRoundRng(`${sessionSeed}:r${roundId}`);
 */
export function createInfernoRoundRng(key: string): ProvablyFairRNG {
  const rng = createRNG(deriveInfernoSeed(key));
  for (let i = 0; i < INFERNO_RNG_WARMUP_DRAWS; i++) rng.random();
  return rng;
}

/**
 * Stable fingerprint of the mathematical configuration (weights, payouts, multipliers, constants).
 * FNV-1a 32-bit over a canonical JSON string — an identifier for reports, not a security hash.
 * @param config Optional config (rules are included in the fingerprint).
 * @returns `{ version, hash, canonical }`.
 * @example
 * getInfernoMathFingerprint().hash; // e.g. '9f1c2a3b'
 */
export function getInfernoMathFingerprint(config?: InfernoConfig): { version: string; hash: string; canonical: string } {
  const canonical = JSON.stringify({
    version: INFERNO_MATH_VERSION,
    grid: [GRID_ROWS, GRID_COLS],
    minCluster: MIN_CLUSTER_SIZE,
    maxHeat: MAX_HEAT_METER,
    freeSpins: FREE_SPINS_AWARDED,
    crownP: CROWN_FLIP_WIN_PROBABILITY,
    weights: SYMBOL_WEIGHTS,
    payouts: SYMBOL_BASE_PAYOUTS,
    multipliers: CLUSTER_MULTIPLIERS,
    maxCascades: MAX_CASCADES_PER_SPIN,
    rules: resolveInfernoRules(config),
  });
  let hash = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i++) {
    hash ^= canonical.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return { version: INFERNO_MATH_VERSION, hash: hash.toString(16).padStart(8, '0'), canonical };
}
