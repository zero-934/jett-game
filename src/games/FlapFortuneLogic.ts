/**
 * @file FlapFortuneLogic.ts
 * @purpose Pure game logic for Flap Fortune — gravity physics, pipe generation,
 *          collision detection, distance multiplier, cash-out, and RTP simulation.
 *          No Phaser dependencies.
 * @author Agent 934
 * @date 2026-04-12
 * @license Proprietary – available for licensing
 */

/** A pipe obstacle pair — top section and bottom section. */
export interface FlapPipe {
  /** Horizontal position of the pipe's left edge. */
  x: number;
  /** Height of the top pipe section (from top of world). */
  topHeight: number;
  /** Height of the bottom pipe section (from bottom of world). */
  bottomHeight: number;
  /** Whether this pipe has already been cleared by the player (for multiplier tracking). */
  cleared: boolean;
}

/** Full state snapshot for Flap Fortune. */
export interface FlapFortuneState {
  playerY: number;
  playerVelocityY: number;
  playerWidth: number;
  playerHeight: number;
  distanceTravelled: number;
  pipesCleared: number;
  multiplier: number;
  pipes: FlapPipe[];
  isAlive: boolean;
  cashedOut: boolean;
  payout: number;
  bet: number;
}

/** Configuration for a Flap Fortune game instance. */
export interface FlapFortuneConfig {
  worldWidth: number;
  worldHeight: number;
  playerWidth?: number;
  playerHeight?: number;
  gravity?: number;
  flapStrength?: number;
  pipeSpacing?: number;
  pipeGapHeight?: number;
  scrollSpeed?: number;
  /** House edge as a fraction (e.g. 0.03 = 3%). */
  houseEdge?: number;
}

const DEFAULT_GRAVITY = 0.5;
const DEFAULT_FLAP_STRENGTH = -8;
const DEFAULT_PIPE_SPACING = 220;
const DEFAULT_GAP_HEIGHT = 180;
const DEFAULT_SCROLL_SPEED = 3;
const DEFAULT_HOUSE_EDGE = 0.03;
const MULTIPLIER_PER_PIPE = 1.1;

/**
 * Creates an initial Flap Fortune game state.
 *
 * @param bet - The player's wager in credits.
 * @param config - World and game configuration.
 * @returns A fresh FlapFortuneState.
 *
 * @example
 * const state = createFlapFortuneState(10, { worldWidth: 390, worldHeight: 844 });
 */
export function createFlapFortuneState(
  bet: number,
  config: FlapFortuneConfig
): FlapFortuneState {
  return {
    playerY: config.worldHeight / 2,
    playerVelocityY: 0,
    playerWidth: config.playerWidth ?? 30,
    playerHeight: config.playerHeight ?? 30,
    distanceTravelled: 0,
    pipesCleared: 0,
    multiplier: 1.0,
    pipes: [generateFlapPipe(config.worldWidth + 100, config)],
    isAlive: true,
    cashedOut: false,
    payout: 0,
    bet,
  };
}

/**
 * Advances the game by one tick — applies gravity, moves pipes, checks collisions.
 *
 * @param state - Current game state (mutated in place).
 * @param isFlapping - Whether the player triggered a flap this tick.
 * @param config - Game configuration.
 * @returns The updated state.
 *
 * @example
 * tickFlapFortune(state, true, { worldWidth: 390, worldHeight: 844 });
 */
export function tickFlapFortune(
  state: FlapFortuneState,
  isFlapping: boolean,
  config: FlapFortuneConfig
): FlapFortuneState {
  if (!state.isAlive || state.cashedOut) return state;

  const gravity = config.gravity ?? DEFAULT_GRAVITY;
  const flapStrength = config.flapStrength ?? DEFAULT_FLAP_STRENGTH;
  const pipeSpacing = config.pipeSpacing ?? DEFAULT_PIPE_SPACING;
  const scrollSpeed = config.scrollSpeed ?? DEFAULT_SCROLL_SPEED;
  const houseEdge = config.houseEdge ?? DEFAULT_HOUSE_EDGE;

  // Physics
  if (isFlapping) {
    state.playerVelocityY = flapStrength;
  }
  state.playerVelocityY += gravity;
  state.playerY += state.playerVelocityY;
  state.distanceTravelled += scrollSpeed;

  // Boundary check (floor/ceiling)
  if (
    state.playerY < state.playerHeight / 2 ||
    state.playerY > config.worldHeight - state.playerHeight / 2
  ) {
    state.isAlive = false;
    state.payout = 0;
    return state;
  }

  // Move pipes left, remove off-screen
  for (const pipe of state.pipes) {
    pipe.x -= scrollSpeed;
  }
  state.pipes = state.pipes.filter((pipe) => pipe.x > -60);

  // Spawn new pipes
  const lastPipe = state.pipes[state.pipes.length - 1];
  if (!lastPipe || lastPipe.x < config.worldWidth - pipeSpacing) {
    state.pipes.push(
      generateFlapPipe(config.worldWidth + 60, config)
    );
  }

  // Check cleared pipes and update multiplier
  const playerCenterX = 80; // fixed horizontal position of player
  for (const pipe of state.pipes) {
    if (!pipe.cleared && pipe.x + 40 < playerCenterX) {
      pipe.cleared = true;
      state.pipesCleared += 1;
    }
  }

  state.multiplier = computeFlapMultiplier(state.pipesCleared, houseEdge);

  // Collision check
  if (checkFlapCollision(state, config)) {
    state.isAlive = false;
    state.payout = 0;
  }

  return state;
}

/**
 * Generates a new pipe with a random gap position.
 *
 * @param spawnX - Horizontal position to spawn the pipe at.
 * @param config - Game configuration.
 * @returns A new FlapPipe.
 *
 * @example
 * const pipe = generateFlapPipe(500, { worldWidth: 390, worldHeight: 844 });
 */
export function generateFlapPipe(
  spawnX: number,
  config: FlapFortuneConfig
): FlapPipe {
  const gapHeight = config.pipeGapHeight ?? DEFAULT_GAP_HEIGHT;
  const margin = 60;
  const maxTopHeight = config.worldHeight - gapHeight - margin;
  const topHeight = margin + Math.random() * (maxTopHeight - margin);
  const bottomHeight = config.worldHeight - topHeight - gapHeight;

  return {
    x: spawnX,
    topHeight,
    bottomHeight,
    cleared: false,
  };
}

/**
 * Computes the payout multiplier based on pipes cleared, adjusted for house edge.
 *
 * @param pipesCleared - Number of pipe pairs successfully passed.
 * @param houseEdge - Fraction taken by the house (default 0.03).
 * @returns The payout multiplier.
 *
 * @example
 * computeFlapMultiplier(5, 0.03); // ~1.57
 */
export function computeFlapMultiplier(
  pipesCleared: number,
  houseEdge: number = DEFAULT_HOUSE_EDGE
): number {
  if (pipesCleared <= 0) return 1.0;
  const rawMultiplier = Math.pow(MULTIPLIER_PER_PIPE, pipesCleared);
  return parseFloat((rawMultiplier * (1 - houseEdge)).toFixed(4));
}

/**
 * Checks whether the player overlaps any pipe.
 *
 * @param state - Current game state.
 * @param config - Game configuration (needs worldHeight).
 * @returns True if there is a collision.
 *
 * @example
 * if (checkFlapCollision(state, config)) { handleDeath(); }
 */
export function checkFlapCollision(
  state: FlapFortuneState,
  config: FlapFortuneConfig
): boolean {
  const playerCenterX = 80;
  const playerLeft = playerCenterX - state.playerWidth / 2;
  const playerRight = playerCenterX + state.playerWidth / 2;
  const playerTop = state.playerY - state.playerHeight / 2;
  const playerBottom = state.playerY + state.playerHeight / 2;
  const pipeWidth = 40;

  for (const pipe of state.pipes) {
    const pipeRight = pipe.x + pipeWidth;
    const pipeLeft = pipe.x;

    // Horizontal overlap?
    if (playerRight <= pipeLeft || playerLeft >= pipeRight) continue;

    // Top pipe collision?
    if (playerTop <= pipe.topHeight) return true;

    // Bottom pipe collision?
    if (playerBottom >= config.worldHeight - pipe.bottomHeight) return true;
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
 * const winnings = cashOutFlapFortune(state);
 */
export function cashOutFlapFortune(state: FlapFortuneState): number {
  if (!state.isAlive || state.cashedOut) return 0;
  state.cashedOut = true;
  state.payout = parseFloat((state.bet * state.multiplier).toFixed(2));
  return state.payout;
}
