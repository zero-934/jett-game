/**
 * @file MinesLogic.ts
 * @purpose Pure game logic for Mines — 5×5 grid, random bomb placement,
 *          safe-tile multiplier progression, cash-out, house edge. No Phaser dependencies.
 * @author Agent 934
 * @date 2026-04-13
 * @license Proprietary – available for licensing
 */

export type BombCount = 3 | 5 | 10;
export type TileState = 'hidden' | 'safe' | 'bomb';

export interface MinesTile {
  index: number;   // 0–24
  row: number;     // 0–4
  col: number;     // 0–4
  hasBomb: boolean;
  state: TileState;
}

export interface MinesState {
  bet: number;
  bombCount: BombCount;
  grid: MinesTile[];
  tilesRevealed: number;
  multiplier: number;
  isAlive: boolean;
  cashedOut: boolean;
  payout: number;
  gameStarted: boolean;
}

export interface MinesConfig {
  houseEdge?: number;
  rng?: () => number;
}

const DEFAULT_HOUSE_EDGE      = 0.03;
const MULTIPLIER_PER_SAFE     = 1.15;
const GRID_SIZE               = 25;

/**
 * Creates an initial Mines game state with bombs placed randomly.
 *
 * @param bet - Wager in credits.
 * @param bombCount - Number of bombs to place (3, 5, or 10).
 * @param config - Game configuration.
 * @returns Fresh MinesState.
 *
 * @example
 * const state = createMinesState(10, 5);
 */
export function createMinesState(
  bet: number,
  bombCount: BombCount = 5,
  config: MinesConfig = {}
): MinesState {
  const rng = config.rng ?? Math.random;

  // Build grid
  const grid: MinesTile[] = [];
  for (let i = 0; i < GRID_SIZE; i++) {
    grid.push({
      index: i,
      row:   Math.floor(i / 5),
      col:   i % 5,
      hasBomb: false,
      state: 'hidden',
    });
  }

  // Place bombs using Fisher-Yates partial shuffle
  const indices = Array.from({ length: GRID_SIZE }, (_, i) => i);
  for (let i = 0; i < bombCount; i++) {
    const j = i + Math.floor(rng() * (GRID_SIZE - i));
    [indices[i], indices[j]] = [indices[j], indices[i]];
    grid[indices[i]].hasBomb = true;
  }

  return {
    bet,
    bombCount,
    grid,
    tilesRevealed: 0,
    multiplier: 1.0,
    isAlive: true,
    cashedOut: false,
    payout: 0,
    gameStarted: true,
  };
}

/**
 * Reveals a tile. If it's a bomb, the game ends. If safe, multiplier increases.
 *
 * @param state - Current game state (mutated).
 * @param tileIndex - Index of the tile to reveal (0–24).
 * @param config - Game configuration.
 * @returns Updated state.
 *
 * @example
 * revealTile(state, 12, {});
 */
export function revealTile(
  state: MinesState,
  tileIndex: number,
  config: MinesConfig = {}
): MinesState {
  if (!state.isAlive || state.cashedOut) return state;

  const tile = state.grid[tileIndex];
  if (!tile || tile.state !== 'hidden') return state;

  const houseEdge = config.houseEdge ?? DEFAULT_HOUSE_EDGE;

  if (tile.hasBomb) {
    tile.state    = 'bomb';
    state.isAlive = false;
    state.payout  = 0;
    // Reveal all bombs
    for (const t of state.grid) {
      if (t.hasBomb) t.state = 'bomb';
    }
  } else {
    tile.state = 'safe';
    state.tilesRevealed++;
    state.multiplier = computeMinesMultiplier(
      state.tilesRevealed,
      state.bombCount,
      houseEdge
    );
  }

  return state;
}

/**
 * Computes the payout multiplier based on safe tiles revealed.
 * Accounts for the decreasing probability of each successive safe pick.
 *
 * @param safeRevealed - Number of safe tiles revealed so far.
 * @param bombCount - Total bombs in the grid.
 * @param houseEdge - House edge fraction.
 * @returns Multiplier value ≥ 1.0.
 *
 * @example
 * computeMinesMultiplier(3, 5, 0.03); // ~1.52
 */
export function computeMinesMultiplier(
  safeRevealed: number,
  _bombCount: BombCount,
  houseEdge: number = DEFAULT_HOUSE_EDGE
): number {
  if (safeRevealed <= 0) return 1.0;
  const raw = Math.pow(MULTIPLIER_PER_SAFE, safeRevealed);
  return parseFloat((raw * (1 - houseEdge)).toFixed(4));
}

/**
 * Processes a cash-out on the current safe state.
 *
 * @param state - Current game state (mutated).
 * @returns Credit payout amount.
 *
 * @example
 * const payout = cashOutMines(state);
 */
export function cashOutMines(state: MinesState): number {
  if (!state.isAlive || state.cashedOut || state.tilesRevealed === 0) return 0;
  state.cashedOut = true;
  state.payout    = parseFloat((state.bet * state.multiplier).toFixed(2));
  return state.payout;
}

/**
 * Simulates rounds to estimate RTP.
 *
 * @param rounds - Number of rounds.
 * @param bombCount - Bomb configuration.
 * @param revealCount - How many tiles to reveal before cashing out.
 * @param config - Game config.
 * @returns Estimated RTP.
 *
 * @example
 * simulateMinesRTP(10000, 5, 3, {});
 */
export function simulateMinesRTP(
  rounds: number,
  bombCount: BombCount,
  revealCount: number,
  config: MinesConfig = {}
): number {
  let totalBet = 0;
  let totalPayout = 0;

  for (let i = 0; i < rounds; i++) {
    totalBet += 1;
    const state = createMinesState(1, bombCount, config);

    // Try to reveal `revealCount` tiles
    const hiddenIndices = state.grid
      .filter(t => t.state === 'hidden')
      .map(t => t.index);

    // Shuffle
    const rng = config.rng ?? Math.random;
    for (let j = hiddenIndices.length - 1; j > 0; j--) {
      const k = Math.floor(rng() * (j + 1));
      [hiddenIndices[j], hiddenIndices[k]] = [hiddenIndices[k], hiddenIndices[j]];
    }

    for (let r = 0; r < revealCount && state.isAlive; r++) {
      revealTile(state, hiddenIndices[r], config);
    }

    if (state.isAlive && state.tilesRevealed > 0) {
      totalPayout += cashOutMines(state);
    } else {
      totalPayout += state.payout;
    }
  }

  return totalPayout / totalBet;
}
