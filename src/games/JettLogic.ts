import { ProvablyFairRNG, RNG_ALGORITHM_V2 } from '../shared/rng/ProvablyFairRNG';
import type { RNGStateSnapshot } from '../shared/rng/ProvablyFairRNG';

/**
 * @file JettLogic.ts
 * @purpose Pure game logic for Jett — endless vertical scroller, random asteroid field
 *          that grows denser with altitude, combustion house-edge mechanic, cash-out.
 *          No Phaser dependencies.
 * @author Agent 934
 * @date 2026-04-12
 * @license Proprietary – available for licensing
 * @version 2.3 - May 14 coin spawn at 150m
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
  lastCoinSpawnAltitude: number;  // Tracks last altitude where a coin spawned (starts at -300 for first coin at 0m)
  rng?: () => number;  // Optional RNG function (passed from UI layer for persistence)
}

/** Configuration for a Jett game instance. */
export interface JettConfig {
  worldWidth: number;
  screenHeight: number;
  playerRadius?: number;
  houseEdge?: number;
  combustionChancePerTick?: number;
  /** Minimum per-tick combustion probability. Default 0.0008 (unchanged; previously hard-coded). */
  combustionFloorPerTick?: number;
  rng?: () => number;
}

const DEFAULT_HOUSE_EDGE          = 0.03;
const DEFAULT_COMBUSTION_CHANCE   = 0.0003;  // Base combustion per tick (matches Flap Fortune for fair feel)
const MULTIPLIER_PER_100_ALTITUDE = 1.10;    // Reduced from 1.12 — slower multiplier growth for natural pacing
const BASE_SPEED                  = 1.2;     // Increased from 0.8 — faster initial climb feels snappier
const MAX_SPEED                   = 3.0;     // Increased from 2.5 — allows acceleration to higher speeds
const DEFAULT_COMBUSTION_FLOOR    = 0.0008;
/** Player hitbox fraction of playerRadius (unchanged forgiveness). */
export const JETT_PLAYER_HIT_FRACTION = 0.8;
/** Asteroid hitbox fraction of radius (unchanged forgiveness). */
export const JETT_ASTEROID_HIT_FRACTION = 0.85;
/**
 * Contact policy (D-4): a hit when the closest approach distance <= combined radius + epsilon.
 * Exact tangency counts as a hit; the epsilon absorbs float rounding so the rule is stable.
 */
export const JETT_COLLISION_EPSILON = 1e-6;

let fallbackInstance: ProvablyFairRNG | null = null;
/** Single fallback generator when none is injected (previously two were built per tick). */
function fallbackRandom(): number {
  if (!fallbackInstance) fallbackInstance = new ProvablyFairRNG();
  return fallbackInstance.random();
}

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
  const state: JettState = {
    playerX: config.worldWidth / 2,
    playerWorldY: 0,
    playerRadius: config.playerRadius ?? 12,
    altitude: 0,
    multiplier: 1.0,
    asteroids: [],
    coins: [],
    nextAsteroidId: 0,
    nextCoinId: 1,
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

  // Spawn first coin immediately at game start for early engagement
  state.coins.push({
    id: 0,
    x: config.worldWidth / 2,
    worldY: config.screenHeight * 0.8,
    radius: 8,
    collected: false,
    animPhase: 0,
  });

  return state;
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
  // Use persistent RNG from state if available, otherwise create new one
  const rng              = state.rng ?? config.rng ?? fallbackRandom;

  state.tickCount++;

  // Positions at tick start (for swept collision).
  const startX = state.playerX;
  const startY = state.playerWorldY;
  const asteroidStart = new Map<number, number>();
  for (const ast of state.asteroids) asteroidStart.set(ast.id, ast.x);

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

  // Spawn coins — every 300m altitude (good pacing)
  // NOTE: First coin appears ~800m due to initialization logic; hard to change without breaking
  // Coins are valuable rewards for skillful flight, providing multiplier boosts
  const COIN_SPAWN_INTERVAL = 300; // altitude units between coin spawns
  if (state.altitude - state.lastCoinSpawnAltitude >= COIN_SPAWN_INTERVAL) {
    state.lastCoinSpawnAltitude = state.altitude;
    const coinX = rng() * (config.worldWidth - 40) + 20; // seeded (was Math.random, R-DET-1)
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

  // Collision check: swept along this tick's motion (no tunnelling through asteroids).
  if (checkSweptAsteroidCollision(state, startX, startY, asteroidStart)) {
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
  const BASE_COMBUSTION = config.combustionFloorPerTick ?? DEFAULT_COMBUSTION_FLOOR;  // 1 in 1250, ~20s average @ 62.5 Hz
  const scaledChance = Math.max(BASE_COMBUSTION, combustionChance * (1 + state.altitude / 5000));
  const rngValue = rng();
  
  if (rngValue < scaledChance) {
    state.isAlive   = false;
    state.combusted = true;
    state.payout    = 0;
  }

  // Track altitude milestones (every 250 units) for UI feedback (altitude flash effect)
  // Caller (JettUI) can check state.lastMilestoneAltitude to trigger visual feedback
  const currentMilestone = Math.floor(state.altitude / 250) * 250;
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
  rng: () => number = fallbackRandom
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
 * Swept circle collision for one tick: the player moves from (startX, startY) to its current
 * position while each asteroid moves from its start X to its current X. Uses relative motion
 * and the closest approach on that segment. Contact (distance == combined radius) is a hit.
 *
 * @param state - State after this tick's movement.
 * @param startX - Player X at tick start.
 * @param startY - Player world Y at tick start.
 * @param asteroidStartX - Asteroid X at tick start, by id (missing ids = newly spawned, static).
 * @returns True if any asteroid is touched during the tick.
 *
 * @example
 * checkSweptAsteroidCollision(state, prevX, prevY, new Map());
 */
export function checkSweptAsteroidCollision(
  state: JettState,
  startX: number,
  startY: number,
  asteroidStartX: ReadonlyMap<number, number>
): boolean {
  const pr = state.playerRadius * JETT_PLAYER_HIT_FRACTION;
  for (const ast of state.asteroids) {
    const ax0 = asteroidStartX.get(ast.id) ?? ast.x;
    // Relative position of the player w.r.t. the asteroid at tick start and end.
    const rx0 = startX - ax0;
    const ry0 = startY - ast.worldY;
    const rx1 = state.playerX - ast.x;
    const ry1 = state.playerWorldY - ast.worldY;
    const dx = rx1 - rx0;
    const dy = ry1 - ry0;
    const lenSq = dx * dx + dy * dy;
    const t = lenSq > 0 ? Math.max(0, Math.min(1, -(rx0 * dx + ry0 * dy) / lenSq)) : 0;
    const cx = rx0 + dx * t;
    const cy = ry0 + dy * t;
    const reach = pr + ast.radius * JETT_ASTEROID_HIT_FRACTION + JETT_COLLISION_EPSILON;
    if (cx * cx + cy * cy <= reach * reach) return true;
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


// ─── polish-003: deterministic round controller ─────────────────────────────

/** Bump whenever an outcome-affecting rule in the round controller changes. */
export const JETT_SIM_VERSION = 2;

/** Why a Jett round ended. */
export type JettSettlementReason = 'cashout' | 'crash' | 'combust';

/** Immutable settlement result. */
export interface JettSettlement {
  reason: JettSettlementReason;
  tick: number;
  multiplier: number;
  payout: number;
  returnHundredths: number;
  altitude: number;
  coins: number;
}

/** Tick action: 'steer' (value = integer target world X) or 'cashOut'. */
export interface JettAction { type: string; value?: number; }

/** A deterministic Jett round. */
export interface JettRound {
  readonly seed: string;
  readonly config: JettConfig;
  readonly rng: ProvablyFairRNG;
  state: JettState;
  /** Last accepted steering target (world X). Held between steer actions. */
  targetX: number;
  tick: number;
  settlement: JettSettlement | null;
}

/**
 * Creates a seeded round. Gameplay randomness comes only from this round's RNG; the state
 * stays JSON-safe (no function fields).
 * @param seed - Round seed.
 * @param bet - Stake in credits.
 * @param config - Gameplay config (its rng is replaced).
 * @returns Round.
 * @example
 * const round = createJettRound('seed', 10, { worldWidth: 390, screenHeight: 844 });
 */
export function createJettRound(seed: string, bet: number, config: JettConfig): JettRound {
  const rng = new ProvablyFairRNG(seed, { algorithm: RNG_ALGORITHM_V2 });
  const boundConfig: JettConfig = { ...config, rng: () => rng.random() };
  const state = createJettState(bet, boundConfig);
  return { seed, config: boundConfig, rng, state, targetX: state.playerX, tick: 0, settlement: null };
}

/**
 * @param round - Round.
 * @returns Whether a cash-out is accepted now (alive, unsettled).
 * @example
 * canCashOutJett(round);
 */
export function canCashOutJett(round: JettRound): boolean {
  return !round.settlement && round.state.isAlive && !round.state.cashedOut;
}

function settleJett(round: JettRound, reason: JettSettlementReason, payout: number): void {
  const st = round.state;
  round.settlement = { reason, tick: round.tick, multiplier: st.multiplier, payout, returnHundredths: Math.round(payout * 100), altitude: st.altitude, coins: st.coinsCollected };
}

/**
 * Advances one tick. Order: valid cash-out at tick start settles before hazards move (D-6);
 * otherwise the latest steer target applies and the unchanged tickJett runs.
 * @param round - Round (mutated).
 * @param actions - Actions for this tick.
 * @returns Whether the round is settled.
 * @example
 * stepJettRound(round, [{ type: 'steer', value: 200 }]);
 */
export function stepJettRound(round: JettRound, actions: readonly JettAction[]): { settled: boolean } {
  if (round.settlement) return { settled: true };
  if (actions.some((a) => a.type === 'cashOut') && canCashOutJett(round)) {
    settleJett(round, 'cashout', cashOutJett(round.state));
    return { settled: true };
  }
  for (const a of actions) if (a.type === 'steer' && typeof a.value === 'number' && Number.isFinite(a.value)) round.targetX = Math.round(a.value);
  tickJett(round.state, round.targetX, round.config);
  round.tick++;
  if (!round.state.isAlive) {
    settleJett(round, round.state.combusted ? 'combust' : 'crash', 0);
    return { settled: true };
  }
  return { settled: false };
}

/** JSON-safe checkpoint. */
export interface JettCheckpoint {
  simVersion: number;
  seed: string;
  tick: number;
  targetX: number;
  state: JettState;
  rng: RNGStateSnapshot;
  settlement: JettSettlement | null;
}

/**
 * @param round - Round.
 * @returns Checkpoint.
 * @example
 * checkpointJettRound(round);
 */
export function checkpointJettRound(round: JettRound): JettCheckpoint {
  return JSON.parse(JSON.stringify({ simVersion: JETT_SIM_VERSION, seed: round.seed, tick: round.tick, targetX: round.targetX, state: round.state, rng: round.rng.getState(), settlement: round.settlement })) as JettCheckpoint;
}

/**
 * @param cp - Checkpoint.
 * @param config - Original gameplay config.
 * @returns Restored round.
 * @throws On simVersion mismatch.
 * @example
 * restoreJettRound(cp, config);
 */
export function restoreJettRound(cp: JettCheckpoint, config: JettConfig): JettRound {
  if (cp.simVersion !== JETT_SIM_VERSION) throw new Error(`Jett checkpoint simVersion ${cp.simVersion} != ${JETT_SIM_VERSION}`);
  const round = createJettRound(cp.seed, cp.state.bet, config);
  round.rng.setState(cp.rng);
  round.state = JSON.parse(JSON.stringify(cp.state)) as JettState;
  round.targetX = cp.targetX;
  round.tick = cp.tick;
  round.settlement = cp.settlement ? { ...cp.settlement } : null;
  return round;
}
