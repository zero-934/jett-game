import { ProvablyFairRNG } from '../shared/rng/ProvablyFairRNG';

/**
 * @file JettLogic.ts
 * @purpose Pure game logic for Jett — endless vertical scroller, random asteroid field
 *          that grows denser with altitude, combustion house-edge mechanic, cash-out.
 *          No Phaser dependencies.
 * @author Agent 934
 * @date 2026-04-12
 * @license Proprietary – available for licensing
 */

/** A single asteroid in world coordinates. */
export interface JettAsteroid {
  id: number;
  x: number;
  /** World Y — altitude at which this asteroid sits. */
  worldY: number;
  radius: number;
  /** Slow horizontal drift speed (world units per tick). */
  driftX: number;
  /** Visual rotation angle (degrees, incremented per tick). */
  rotationAngle: number;
  rotationSpeed: number;
}

/** A single coin in world coordinates. */
export interface JettCoin {
  id: number;
  x: number;
  /** World Y — altitude at which this coin sits. */
  worldY: number;
  radius: number;
  /** Collected flag — true if player has picked this up. */
  collected: boolean;
  /** Animation phase (0-1) for pulse effect. */
  animPhase: number;
}

/** Full Jett game state snapshot. */
export interface JettState {
  playerX: number;
  playerWorldY: number;
  playerRadius: number;
  altitude: number;
  multiplier: number;
  asteroids: JettAsteroid[];
  coins: JettCoin[];
  nextAsteroidId: number;
  nextCoinId: number;
  coinsCollected: number;
  isAlive: boolean;
  cashedOut: boolean;
  combusted: boolean;
  payout: number;
  bet: number;
  speed: number;
  tickCount: number;
  lastMilestoneAltitude: number;  // Tracks altitude milestones (every 100) for UI feedback
  lastCoinSpawnAltitude: number;  // Tracks last altitude where a coin spawned
}

/** Configuration for a Jett game instance. */
export interface JettConfig {
  worldWidth: number;
  screenHeight: number;
  playerRadius?: number;
  houseEdge?: number;
  combustionChancePerTick?: number;
  rng?: () => number;
}

const DEFAULT_HOUSE_EDGE          = 0.03;
const DEFAULT_COMBUSTION_CHANCE   = 0.0003;  // Base combustion per tick (matches Flap Fortune for fair feel)
const MULTIPLIER_PER_100_ALTITUDE = 1.10;    // Reduced from 1.12 — slower multiplier growth for natural pacing
const BASE_SPEED                  = 1.2;     // Increased from 0.8 — faster initial climb feels snappier
const MAX_SPEED                   = 3.0;     // Increased from 2.5 — allows acceleration to higher speeds

/** How many asteroid "slots" exist per spawn wave. Increases with altitude. */
function asteroidsPerWave(altitude: number): number {
  return Math.min(1 + Math.floor(altitude / 600), 5);
}

/** Vertical spacing between spawn waves (decreases with altitude). */
function waveSpacing(altitude: number): number {
  return Math.max(140, 320 - Math.floor(altitude / 400) * 10);
}

/**
 * Creates an initial Jett game state.
 *
 * @param bet - Wager in credits.
 * @param config - World configuration.
 * @returns Fresh JettState.
 *
 * @example
 * const state = createJettState(10, { worldWidth: 390, screenHeight: 844 });
 */
export function createJettState(bet: number, config: JettConfig): JettState {
  return {
    playerX: config.worldWidth / 2,
    playerWorldY: 0,
    playerRadius: config.playerRadius ?? 12,
    altitude: 0,
    multiplier: 1.0,
    asteroids: [],
    coins: [],
    nextAsteroidId: 0,
    nextCoinId: 0,
    coinsCollected: 0,
    isAlive: true,
    cashedOut: false,
    combusted: false,
    payout: 0,
    bet,
    speed: BASE_SPEED,
    tickCount: 0,
    lastMilestoneAltitude: 0,
    lastCoinSpawnAltitude: 0,
  };
}

/**
 * Advances the game by one tick — ascends the player, spawns asteroids,
 * drifts existing asteroids, checks collisions, rolls combustion.
 *
 * @param state - Current game state (mutated in place).
 * @param newPlayerX - Updated horizontal position from input.
 * @param config - Game configuration.
 * @returns The updated state.
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

  const houseEdge        = config.houseEdge               ?? DEFAULT_HOUSE_EDGE;
  const combustionChance = config.combustionChancePerTick  ?? DEFAULT_COMBUSTION_CHANCE;
  const _rng = new ProvablyFairRNG();
  const rng              = config.rng                      ?? _rng.random.bind(_rng);

  state.tickCount++;

  // Clamp player X
  const pr = state.playerRadius;
  state.playerX = Math.max(pr, Math.min(config.worldWidth - pr, newPlayerX));

  // Ramp speed
  state.speed = Math.min(MAX_SPEED, BASE_SPEED + state.altitude / 900);

  // Ascend
  state.altitude     += state.speed;
  state.playerWorldY  = state.altitude;

  // Drift existing asteroids horizontally and rotate them
  for (const ast of state.asteroids) {
    ast.x             += ast.driftX;
    ast.rotationAngle += ast.rotationSpeed;
    // Bounce off walls
    if (ast.x - ast.radius < 0 || ast.x + ast.radius > config.worldWidth) {
      ast.driftX *= -1;
    }
  }

  // Spawn new asteroid waves ahead of the player
  const spacing    = waveSpacing(state.altitude);
  const lookAhead  = config.screenHeight * 1.2; // spawn up to this far ahead

  // Determine the highest already-spawned asteroid worldY
  const highestY   = state.asteroids.reduce((max, a) => Math.max(max, a.worldY), state.altitude);
  const nextWaveY  = Math.ceil((highestY + 1) / spacing) * spacing;

  if (nextWaveY < state.altitude + lookAhead) {
    const count   = asteroidsPerWave(state.altitude);
    const newAsts = spawnAsteroidWave(nextWaveY, count, config.worldWidth, state.nextAsteroidId, rng);
    state.nextAsteroidId += newAsts.length;
    state.asteroids.push(...newAsts);
  }

  // Cull asteroids far below
  state.asteroids = state.asteroids.filter(a => a.worldY > state.altitude - config.screenHeight);

  // Spawn coins — every 300m altitude
  // Coins are valuable rewards for skillful flight, providing multiplier boosts
  const COIN_SPAWN_INTERVAL = 300; // altitude units between coin spawns
  if (state.altitude - state.lastCoinSpawnAltitude >= COIN_SPAWN_INTERVAL) {
    state.lastCoinSpawnAltitude = state.altitude;
    const coinX = Math.random() * (config.worldWidth - 40) + 20; // Keep within bounds
    const coin: JettCoin = {
      id: state.nextCoinId++,
      x: coinX,
      worldY: state.altitude + config.screenHeight * 0.8, // Spawn ahead in view
      radius: 8,
      collected: false,
      animPhase: 0,
    };
    state.coins.push(coin);
  }

  // Update coin animations and cull far below
  for (const coin of state.coins) {
    coin.animPhase = (coin.animPhase + 0.05) % 1; // Pulse animation
  }
  state.coins = state.coins.filter(c => !c.collected && c.worldY > state.altitude - config.screenHeight);

  // Check coin collection
  for (const coin of state.coins) {
    if (!coin.collected) {
      const dx = state.playerX - coin.x;
      const dy = state.playerWorldY - coin.worldY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < state.playerRadius + coin.radius) {
        coin.collected = true;
        state.coinsCollected++;
        // Apply multiplier boost: +0.03x per coin
        state.multiplier += 0.03;
      }
    }
  }

  // Update multiplier (accounts for coin boosts)
  state.multiplier = computeMultiplier(state.altitude, houseEdge) + (state.coinsCollected * 0.03);

  // Collision check
  if (checkAsteroidCollision(state)) {
    state.isAlive = false;
    state.payout  = 0;
    return state;
  }

  // Combustion (house edge mechanic) — scales with altitude like Flap Fortune scales with pipes
  // Base rate = 0.0005 (0.05% per frame = ~1 in 2000) — balanced for visibility + fairness.
  // Scales up with altitude so higher multipliers carry real risk.
  // This ensures: (a) house edge is always present, (b) occasional instant failures
  // create psychological tension without feeling random, (c) skill dominates early, risk compounds late.
  // Matches Flap Fortune psychology: BASE_COMBUSTION * (1 + progress_metric * scaling_factor)
  const BASE_COMBUSTION = 0.0005;  // Increased from 0.0003 for better visibility + fairness
  const scaledChance = Math.max(BASE_COMBUSTION, combustionChance * (1 + state.altitude / 5000));
  const rngValue = rng();
  if (rngValue < scaledChance) {
    state.isAlive   = false;
    state.combusted = true;
    state.payout    = 0;
  }

  // Track altitude milestones (every 100 units) for UI feedback (altitude flash effect)
  // Caller (JettUI) can check state.lastMilestoneAltitude to trigger visual feedback
  const currentMilestone = Math.floor(state.altitude / 100) * 100;
  if (currentMilestone > state.lastMilestoneAltitude && currentMilestone > 0) {
    state.lastMilestoneAltitude = currentMilestone;
  }

  return state;
}

/**
 * Spawns a wave of randomly-placed asteroids at a given world altitude.
 *
 * @param worldY - Altitude of this wave.
 * @param count - Number of asteroids in this wave.
 * @param worldWidth - Horizontal world width.
 * @param startId - Starting ID for new asteroids.
 * @param rng - Random number generator.
 * @returns Array of new JettAsteroid objects.
 *
 * @example
 * const wave = spawnAsteroidWave(500, 3, 390, 0, Math.random);
 */
export function spawnAsteroidWave(
  worldY: number,
  count: number,
  worldWidth: number,
  startId: number,
  rng: () => number = new ProvablyFairRNG().random.bind(new ProvablyFairRNG())
): JettAsteroid[] {
  const asteroids: JettAsteroid[] = [];
  const margin = 30;

  // Divide width into slots to avoid all asteroids clustering on one side
  const slotWidth = (worldWidth - margin * 2) / count;

  for (let i = 0; i < count; i++) {
    const radius = 22 + rng() * 20; // 22–42px — bigger but fewer
    const slotX  = margin + i * slotWidth;
    const x      = slotX + rng() * (slotWidth - radius * 2) + radius;

    // Slight vertical scatter within the wave band
    const yOffset = (rng() - 0.5) * 40;

    asteroids.push({
      id:            startId + i,
      x:             Math.max(radius, Math.min(worldWidth - radius, x)),
      worldY:        worldY + yOffset,
      radius,
      driftX:        (rng() - 0.5) * 0.6,
      rotationAngle: rng() * 360,
      rotationSpeed: (rng() - 0.5) * 2,
    });
  }

  return asteroids;
}

/**
 * Checks whether the player (circle) overlaps any asteroid (circle).
 *
 * @param state - Current game state.
 * @returns True if collision detected.
 *
 * @example
 * if (checkAsteroidCollision(state)) { handleDeath(); }
 */
export function checkAsteroidCollision(state: JettState): boolean {
  const px = state.playerX;
  const py = state.playerWorldY;
  const pr = state.playerRadius * 0.8; // slight forgiveness

  for (const ast of state.asteroids) {
    const dx   = px - ast.x;
    const dy   = py - ast.worldY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < pr + ast.radius * 0.85) return true;
  }
  return false;
}

/**
 * Computes the payout multiplier based on altitude.
 *
 * @param altitude - Current altitude in world units.
 * @param houseEdge - Fraction taken by the house.
 * @returns Multiplier value ≥ 1.0.
 *
 * @example
 * computeMultiplier(500, 0.03); // ~1.55
 */
export function computeMultiplier(altitude: number, houseEdge: number = DEFAULT_HOUSE_EDGE): number {
  if (altitude <= 0) return 1.0;
  const steps = altitude / 100;
  return parseFloat((Math.pow(MULTIPLIER_PER_100_ALTITUDE, steps) * (1 - houseEdge)).toFixed(4));
}

/**
 * Processes a cash-out.
 *
 * @param state - Current game state (mutated).
 * @returns Credit payout amount.
 *
 * @example
 * const payout = cashOutJett(state);
 */
export function cashOutJett(state: JettState): number {
  if (!state.isAlive || state.cashedOut) return 0;
  state.cashedOut = true;
  state.payout    = parseFloat((state.bet * state.multiplier).toFixed(2));
  return state.payout;
}
