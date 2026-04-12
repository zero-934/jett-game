/**
 * @file JettLogic.ts
 * @purpose Pure game logic for Jett — endless vertical scroller with altitude-based multiplier,
 *          android obstacle generation, collision detection, random combustion (house edge mechanic),
 *          and cash-out. No Phaser dependencies.
 * @author Agent 934
 * @date 2026-04-12
 * @license Proprietary – available for licensing
 */

/** A rectangular android obstacle in world coordinates. */
export interface JettObstacle {
  x: number;
  y: number;       // world Y (increases as player ascends)
  width: number;
  height: number;
  id: number;
}

/** Full Jett game state snapshot. */
export interface JettState {
  playerX: number;
  playerWorldY: number;    // player's position in world space (increases upward)
  playerWidth: number;
  playerHeight: number;
  altitude: number;        // metres climbed — same as playerWorldY
  multiplier: number;
  obstacles: JettObstacle[];
  nextObstacleId: number;
  isAlive: boolean;
  cashedOut: boolean;
  combusted: boolean;      // true if random combustion fired
  payout: number;
  bet: number;
  speed: number;           // current ascent speed (increases over time)
  tickCount: number;
}

/** Configuration for a Jett game instance. */
export interface JettConfig {
  worldWidth: number;
  screenHeight: number;
  playerWidth?: number;
  playerHeight?: number;
  /** House edge as a fraction (e.g. 0.03 = 3%). */
  houseEdge?: number;
  /** Vertical distance (world units) between android rows. */
  obstacleSpacing?: number;
  /** Horizontal gap the player can fly through. */
  obstacleGapWidth?: number;
  /** Base probability per tick of random combustion (house edge mechanic). */
  combustionChancePerTick?: number;
  /** RNG override for testing. */
  rng?: () => number;
}

const DEFAULT_HOUSE_EDGE          = 0.03;
const DEFAULT_OBSTACLE_SPACING    = 200;
const DEFAULT_GAP_WIDTH           = 150;
const DEFAULT_COMBUSTION_CHANCE   = 0.0004; // ~1 in 2500 ticks
const MULTIPLIER_PER_100_ALTITUDE = 1.12;
const BASE_SPEED                  = 2;
const MAX_SPEED                   = 7;

/**
 * Creates an initial Jett game state.
 *
 * @param bet - The player's wager in credits.
 * @param config - World and game configuration.
 * @returns A fresh JettState.
 *
 * @example
 * const state = createJettState(10, { worldWidth: 390, screenHeight: 844 });
 */
export function createJettState(bet: number, config: JettConfig): JettState {
  return {
    playerX: config.worldWidth / 2,
    playerWorldY: 0,
    playerWidth: config.playerWidth ?? 24,
    playerHeight: config.playerHeight ?? 36,
    altitude: 0,
    multiplier: 1.0,
    obstacles: [],
    nextObstacleId: 0,
    isAlive: true,
    cashedOut: false,
    combusted: false,
    payout: 0,
    bet,
    speed: BASE_SPEED,
    tickCount: 0,
  };
}

/**
 * Advances the game by one tick.
 * Moves the player upward, spawns android obstacles, checks collisions,
 * and rolls the combustion mechanic.
 *
 * @param state - Current game state (mutated in place).
 * @param newPlayerX - Updated horizontal position from input.
 * @param config - Game configuration.
 * @returns The updated state (same reference).
 *
 * @example
 * tickJett(state, 195, config);
 */
export function tickJett(
  state: JettState,
  newPlayerX: number,
  config: JettConfig
): JettState {
  if (!state.isAlive || state.cashedOut) return state;

  const spacing          = config.obstacleSpacing    ?? DEFAULT_OBSTACLE_SPACING;
  const gapWidth         = config.obstacleGapWidth   ?? DEFAULT_GAP_WIDTH;
  const houseEdge        = config.houseEdge          ?? DEFAULT_HOUSE_EDGE;
  const combustionChance = config.combustionChancePerTick ?? DEFAULT_COMBUSTION_CHANCE;
  const rng              = config.rng                ?? Math.random;

  state.tickCount++;

  // Clamp horizontal movement
  const hw = state.playerWidth / 2;
  state.playerX = Math.max(hw, Math.min(config.worldWidth - hw, newPlayerX));

  // Ramp speed with altitude (capped)
  state.speed = Math.min(MAX_SPEED, BASE_SPEED + state.altitude / 800);

  // Ascend
  state.altitude        += state.speed;
  state.playerWorldY     = state.altitude;

  // Spawn android rows — one every `spacing` altitude units
  const nextRowAltitude = (Math.floor(state.altitude / spacing) + 1) * spacing;
  const alreadySpawned  = state.obstacles.some(
    o => Math.abs(o.y - nextRowAltitude) < 1
  );
  if (!alreadySpawned && nextRowAltitude <= state.altitude + spacing) {
    const newObstacles = spawnAndroidRow(
      nextRowAltitude,
      config.worldWidth,
      gapWidth,
      state.nextObstacleId
    );
    state.nextObstacleId += newObstacles.length;
    state.obstacles.push(...newObstacles);
  }

  // Cull obstacles far below (more than 2 screen heights behind)
  state.obstacles = state.obstacles.filter(
    o => o.y > state.altitude - config.screenHeight * 2
  );

  // Update multiplier
  state.multiplier = computeMultiplier(state.altitude, houseEdge);

  // Collision check
  if (checkJettCollision(state)) {
    state.isAlive = false;
    state.payout  = 0;
    return state;
  }

  // Random combustion (house edge mechanic) — chance scales with altitude
  const scaledCombustionChance = combustionChance * (1 + state.altitude / 5000);
  if (rng() < scaledCombustionChance) {
    state.isAlive    = false;
    state.combusted  = true;
    state.payout     = 0;
  }

  return state;
}

/**
 * Generates a pair of android obstacles forming a gap at the given altitude.
 *
 * @param altitudeY - World Y position of this obstacle row.
 * @param worldWidth - Total horizontal world width.
 * @param gapWidth - Width of the passable gap.
 * @param startId - ID to assign to first obstacle.
 * @returns Array of two JettObstacle objects (left android wall, right android wall).
 *
 * @example
 * const row = spawnAndroidRow(400, 390, 150, 0);
 */
export function spawnAndroidRow(
  altitudeY: number,
  worldWidth: number,
  gapWidth: number,
  startId: number
): JettObstacle[] {
  const obstacleHeight = 40;
  const margin = 16;
  const gapStart = margin + Math.random() * (worldWidth - gapWidth - margin * 2);
  const gapEnd   = gapStart + gapWidth;

  return [
    { id: startId,     x: 0,       y: altitudeY, width: gapStart,           height: obstacleHeight },
    { id: startId + 1, x: gapEnd,  y: altitudeY, width: worldWidth - gapEnd, height: obstacleHeight },
  ];
}

/**
 * Computes the payout multiplier based on altitude, adjusted for house edge.
 *
 * @param altitude - Player's current altitude in world units.
 * @param houseEdge - Fraction taken by the house (default 0.03).
 * @returns The current multiplier (≥ 1.0).
 *
 * @example
 * computeMultiplier(500, 0.03); // ~1.55
 */
export function computeMultiplier(
  altitude: number,
  houseEdge: number = DEFAULT_HOUSE_EDGE
): number {
  if (altitude <= 0) return 1.0;
  const steps = altitude / 100;
  const raw   = Math.pow(MULTIPLIER_PER_100_ALTITUDE, steps);
  return parseFloat((raw * (1 - houseEdge)).toFixed(4));
}

/**
 * Checks whether the player bounding box overlaps any obstacle.
 * Uses world coordinates: obstacle.y is the altitude of the row.
 *
 * @param state - Current game state.
 * @returns True if there is a collision.
 *
 * @example
 * if (checkJettCollision(state)) { handleDeath(); }
 */
export function checkJettCollision(state: JettState): boolean {
  const px  = state.playerX - state.playerWidth  / 2;
  const py  = state.playerWorldY;
  const pw  = state.playerWidth;
  const ph  = state.playerHeight;

  for (const obs of state.obstacles) {
    // Obstacle is "at" the player when altitude is within the obstacle's height band
    const obsTop    = obs.y;
    const obsBottom = obs.y - obs.height;
    const playerTop = py;
    const playerBot = py - ph;

    if (playerTop >= obsBottom && playerBot <= obsTop) {
      // Vertical overlap — check horizontal
      if (px < obs.x + obs.width && px + pw > obs.x) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Processes a player cash-out.
 *
 * @param state - Current game state (mutated in place).
 * @returns The credit payout amount.
 *
 * @example
 * const winnings = cashOutJett(state);
 */
export function cashOutJett(state: JettState): number {
  if (!state.isAlive || state.cashedOut) return 0;
  state.cashedOut = true;
  state.payout    = parseFloat((state.bet * state.multiplier).toFixed(2));
  return state.payout;
}
