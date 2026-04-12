/**
 * @file JettLogic.ts
 * @purpose Pure game logic for Jett — altitude-based multiplier, obstacle generation,
 *          collision detection, cash-out, and RTP simulation. No Phaser dependencies.
 * @author Agent 934
 * @date 2026-04-12
 * @license Proprietary – available for licensing
 */

/** Represents a rectangular obstacle in game-world coordinates. */
export interface JettObstacle {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Snapshot of the full Jett game state. */
export interface JettState {
  playerX: number;
  playerY: number;
  playerWidth: number;
  playerHeight: number;
  altitude: number;
  multiplier: number;
  obstacles: JettObstacle[];
  isAlive: boolean;
  cashedOut: boolean;
  payout: number;
  bet: number;
}

/** Configuration for a Jett game instance. */
export interface JettConfig {
  worldWidth: number;
  worldHeight: number;
  playerWidth?: number;
  playerHeight?: number;
  /** House edge as a fraction (e.g. 0.03 = 3%). */
  houseEdge?: number;
  /** How many altitude units between obstacle rows. */
  obstacleSpacing?: number;
  /** Gap in world units that the player can fit through. */
  obstacleGapWidth?: number;
}

const DEFAULT_HOUSE_EDGE = 0.03;
const DEFAULT_OBSTACLE_SPACING = 120;
const DEFAULT_GAP_WIDTH = 160;
const MULTIPLIER_PER_OBSTACLE = 1.08; // raw; adjusted for house edge at cash-out

/**
 * Creates an initial Jett game state.
 *
 * @param bet - The player's wager in credits.
 * @param config - World and game configuration.
 * @returns A fresh JettState ready for the first tick.
 *
 * @example
 * const state = createJettState(10, { worldWidth: 390, worldHeight: 844 });
 */
export function createJettState(bet: number, config: JettConfig): JettState {
  return {
    playerX: config.worldWidth / 2,
    playerY: config.worldHeight - 60,
    playerWidth: config.playerWidth ?? 30,
    playerHeight: config.playerHeight ?? 30,
    altitude: 0,
    multiplier: 1.0,
    obstacles: [],
    isAlive: true,
    cashedOut: false,
    payout: 0,
    bet,
  };
}

/**
 * Advances the game by one tick — moves the player up, spawns obstacles,
 * and checks for collisions.
 *
 * @param state - Current game state (mutated in place).
 * @param newPlayerX - Updated horizontal position from input.
 * @param ascentPerTick - How many world units the player ascends per tick.
 * @param config - Game configuration.
 * @returns The updated state (same reference).
 *
 * @example
 * tickJett(state, 195, 2, { worldWidth: 390, worldHeight: 844 });
 */
export function tickJett(
  state: JettState,
  newPlayerX: number,
  ascentPerTick: number,
  config: JettConfig
): JettState {
  if (!state.isAlive || state.cashedOut) return state;

  const spacing = config.obstacleSpacing ?? DEFAULT_OBSTACLE_SPACING;
  const gapWidth = config.obstacleGapWidth ?? DEFAULT_GAP_WIDTH;

  // Move player up
  state.playerX = clamp(
    newPlayerX,
    state.playerWidth / 2,
    config.worldWidth - state.playerWidth / 2
  );
  state.altitude += ascentPerTick;
  state.playerY = config.worldHeight - 60 - state.altitude;

  // Spawn new obstacle rows as altitude increases
  const nextObstacleAltitude =
    (Math.floor(state.altitude / spacing) + 1) * spacing;
  const existingAtNext = state.obstacles.find(
    (o) => Math.abs(o.y - (config.worldHeight - 60 - nextObstacleAltitude)) < 1
  );

  if (!existingAtNext && nextObstacleAltitude <= state.altitude + spacing) {
    const newObstacles = generateObstacleRow(
      nextObstacleAltitude,
      config.worldWidth,
      config.worldHeight,
      gapWidth
    );
    state.obstacles.push(...newObstacles);
  }

  // Recompute multiplier based on obstacles cleared
  const obstaclesCleared = Math.floor(state.altitude / spacing);
  state.multiplier = computeMultiplier(
    obstaclesCleared,
    config.houseEdge ?? DEFAULT_HOUSE_EDGE
  );

  // Collision check
  if (checkJettCollision(state)) {
    state.isAlive = false;
    state.payout = 0;
  }

  return state;
}

/**
 * Generates a pair of rectangle obstacles forming a gap for the player to pass through.
 *
 * @param altitudeY - The altitude at which this row spawns.
 * @param worldWidth - Total horizontal world width.
 * @param worldHeight - Total vertical world height.
 * @param gapWidth - Width of the passable gap in world units.
 * @returns An array of two obstacle rectangles (left wall, right wall).
 *
 * @example
 * const row = generateObstacleRow(240, 390, 844, 160);
 */
export function generateObstacleRow(
  altitudeY: number,
  worldWidth: number,
  worldHeight: number,
  gapWidth: number
): JettObstacle[] {
  const obstacleHeight = 24;
  const screenY = worldHeight - 60 - altitudeY;
  const margin = 20;
  const gapStart =
    margin + Math.random() * (worldWidth - gapWidth - margin * 2);
  const gapEnd = gapStart + gapWidth;

  const leftWall: JettObstacle = {
    x: 0,
    y: screenY,
    width: gapStart,
    height: obstacleHeight,
  };

  const rightWall: JettObstacle = {
    x: gapEnd,
    y: screenY,
    width: worldWidth - gapEnd,
    height: obstacleHeight,
  };

  return [leftWall, rightWall];
}

/**
 * Computes the current payout multiplier based on number of obstacles cleared.
 * Applies house edge so expected RTP = 1 - houseEdge.
 *
 * @param obstaclesCleared - How many obstacle rows the player has passed.
 * @param houseEdge - Fraction taken as house edge (default 0.03).
 * @returns The current multiplier (≥ 1.0).
 *
 * @example
 * const m = computeMultiplier(5, 0.03); // ~1.35
 */
export function computeMultiplier(
  obstaclesCleared: number,
  houseEdge: number = DEFAULT_HOUSE_EDGE
): number {
  if (obstaclesCleared <= 0) return 1.0;
  const rawMultiplier = Math.pow(MULTIPLIER_PER_OBSTACLE, obstaclesCleared);
  return parseFloat((rawMultiplier * (1 - houseEdge)).toFixed(4));
}

/**
 * Checks whether the player's bounding box overlaps any obstacle.
 *
 * @param state - Current game state.
 * @returns True if there is a collision.
 *
 * @example
 * if (checkJettCollision(state)) { handleDeath(); }
 */
export function checkJettCollision(state: JettState): boolean {
  const px = state.playerX - state.playerWidth / 2;
  const py = state.playerY - state.playerHeight / 2;
  const pw = state.playerWidth;
  const ph = state.playerHeight;

  for (const obstacle of state.obstacles) {
    if (
      px < obstacle.x + obstacle.width &&
      px + pw > obstacle.x &&
      py < obstacle.y + obstacle.height &&
      py + ph > obstacle.y
    ) {
      return true;
    }
  }
  return false;
}

/**
 * Processes a player cash-out and returns final payout.
 *
 * @param state - Current game state (mutated in place).
 * @returns The credit payout amount.
 *
 * @example
 * const winnings = cashOutJett(state); // e.g. 13.5
 */
export function cashOutJett(state: JettState): number {
  if (!state.isAlive || state.cashedOut) return 0;
  state.cashedOut = true;
  state.payout = parseFloat((state.bet * state.multiplier).toFixed(2));
  return state.payout;
}

/** Clamps a value between min and max. */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
