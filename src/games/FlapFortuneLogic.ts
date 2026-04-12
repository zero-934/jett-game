/**
 * @file FlapFortuneLogic.ts
 * @purpose Pure game logic for Flap Fortune — gravity physics, Mario-style red pipe generation,
 *          collision detection, distance multiplier, random combustion (house edge mechanic),
 *          and cash-out. No Phaser dependencies.
 * @author Agent 934
 * @date 2026-04-12
 * @license Proprietary – available for licensing
 */

export interface FlapPipe {
  x: number;
  topHeight: number;
  bottomHeight: number;
  cleared: boolean;
}

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
  combusted: boolean;
  cashedOut: boolean;
  payout: number;
  bet: number;
}

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
  houseEdge?: number;
  /** Per-tick combustion chance (house edge mechanic). */
  combustionChancePerTick?: number;
  rng?: () => number;
}

const DEFAULT_GRAVITY          = 0.45;
const DEFAULT_FLAP_STRENGTH    = -7.5;
const DEFAULT_PIPE_SPACING     = 230;
const DEFAULT_GAP_HEIGHT       = 170;
const DEFAULT_SCROLL_SPEED     = 3;
const DEFAULT_HOUSE_EDGE       = 0.03;
const DEFAULT_COMBUSTION_CHANCE = 0.0003;
const MULTIPLIER_PER_PIPE      = 1.09;

/**
 * Creates an initial Flap Fortune state.
 *
 * @param bet - Wager in credits.
 * @param config - Game configuration.
 * @returns Fresh FlapFortuneState.
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
    playerWidth:  config.playerWidth  ?? 28,
    playerHeight: config.playerHeight ?? 28,
    distanceTravelled: 0,
    pipesCleared: 0,
    multiplier: 1.0,
    pipes: [generateFlapPipe(config.worldWidth + 100, config)],
    isAlive: true,
    combusted: false,
    cashedOut: false,
    payout: 0,
    bet,
  };
}

/**
 * Advances game by one tick.
 *
 * @param state - Current game state (mutated).
 * @param isFlapping - Whether player flapped this tick.
 * @param config - Game configuration.
 * @returns Updated state.
 *
 * @example
 * tickFlapFortune(state, true, config);
 */
export function tickFlapFortune(
  state: FlapFortuneState,
  isFlapping: boolean,
  config: FlapFortuneConfig
): FlapFortuneState {
  if (!state.isAlive || state.cashedOut) return state;

  const gravity          = config.gravity          ?? DEFAULT_GRAVITY;
  const flapStrength     = config.flapStrength     ?? DEFAULT_FLAP_STRENGTH;
  const pipeSpacing      = config.pipeSpacing      ?? DEFAULT_PIPE_SPACING;
  const scrollSpeed      = config.scrollSpeed      ?? DEFAULT_SCROLL_SPEED;
  const houseEdge        = config.houseEdge        ?? DEFAULT_HOUSE_EDGE;
  const combustionChance = config.combustionChancePerTick ?? DEFAULT_COMBUSTION_CHANCE;
  const rng              = config.rng              ?? Math.random;

  if (isFlapping) state.playerVelocityY = flapStrength;
  state.playerVelocityY += gravity;
  state.playerY         += state.playerVelocityY;
  state.distanceTravelled += scrollSpeed;

  // Boundary
  const halfH = state.playerHeight / 2;
  if (state.playerY < halfH || state.playerY > config.worldHeight - halfH) {
    state.isAlive = false;
    state.payout  = 0;
    return state;
  }

  // Move pipes
  for (const pipe of state.pipes) pipe.x -= scrollSpeed;
  state.pipes = state.pipes.filter(p => p.x > -60);

  // Spawn new pipes
  const lastPipe = state.pipes[state.pipes.length - 1];
  if (!lastPipe || lastPipe.x < config.worldWidth - pipeSpacing) {
    state.pipes.push(generateFlapPipe(config.worldWidth + 60, config));
  }

  // Track cleared pipes
  const playerX = 80;
  for (const pipe of state.pipes) {
    if (!pipe.cleared && pipe.x + 30 < playerX) {
      pipe.cleared = true;
      state.pipesCleared++;
    }
  }

  state.multiplier = computeFlapMultiplier(state.pipesCleared, houseEdge);

  // Collision
  if (checkFlapCollision(state, config)) {
    state.isAlive = false;
    state.payout  = 0;
    return state;
  }

  // Combustion
  if (rng() < combustionChance * (1 + state.pipesCleared * 0.05)) {
    state.isAlive   = false;
    state.combusted = true;
    state.payout    = 0;
  }

  return state;
}

/**
 * Generates a new pipe with a random gap.
 *
 * @param spawnX - X position to spawn at.
 * @param config - Game configuration.
 * @returns A new FlapPipe.
 *
 * @example
 * const pipe = generateFlapPipe(500, config);
 */
export function generateFlapPipe(spawnX: number, config: FlapFortuneConfig): FlapPipe {
  const gapHeight  = config.pipeGapHeight ?? DEFAULT_GAP_HEIGHT;
  const margin     = 70;
  const maxTop     = config.worldHeight - gapHeight - margin;
  const topHeight  = margin + Math.random() * (maxTop - margin);
  const bottomHeight = config.worldHeight - topHeight - gapHeight;
  return { x: spawnX, topHeight, bottomHeight, cleared: false };
}

/**
 * Computes the payout multiplier from pipes cleared.
 *
 * @param pipesCleared - Number of pipes passed.
 * @param houseEdge - Fraction taken by house.
 * @returns Multiplier value.
 *
 * @example
 * computeFlapMultiplier(5, 0.03); // ~1.52
 */
export function computeFlapMultiplier(pipesCleared: number, houseEdge: number = DEFAULT_HOUSE_EDGE): number {
  if (pipesCleared <= 0) return 1.0;
  return parseFloat((Math.pow(MULTIPLIER_PER_PIPE, pipesCleared) * (1 - houseEdge)).toFixed(4));
}

/**
 * Checks collision with any pipe.
 *
 * @param state - Current game state.
 * @param config - Game config (needs worldHeight).
 * @returns True if collision detected.
 *
 * @example
 * if (checkFlapCollision(state, config)) { handleDeath(); }
 */
export function checkFlapCollision(state: FlapFortuneState, config: FlapFortuneConfig): boolean {
  const px = 80;
  const pl = px - state.playerWidth  / 2;
  const pr = px + state.playerWidth  / 2;
  const pt = state.playerY - state.playerHeight / 2;
  const pb = state.playerY + state.playerHeight / 2;
  const pipeW = 30;

  for (const pipe of state.pipes) {
    if (pr <= pipe.x || pl >= pipe.x + pipeW) continue;
    if (pt <= pipe.topHeight) return true;
    if (pb >= config.worldHeight - pipe.bottomHeight) return true;
  }
  return false;
}

/**
 * Processes a cash-out.
 *
 * @param state - Current game state (mutated).
 * @returns Credit payout amount.
 *
 * @example
 * const payout = cashOutFlapFortune(state);
 */
export function cashOutFlapFortune(state: FlapFortuneState): number {
  if (!state.isAlive || state.cashedOut) return 0;
  state.cashedOut = true;
  state.payout    = parseFloat((state.bet * state.multiplier).toFixed(2));
  return state.payout;
}
