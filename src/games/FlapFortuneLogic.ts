import { ProvablyFairRNG, RNG_ALGORITHM_V2 } from '../shared/rng/ProvablyFairRNG';
import type { RNGStateSnapshot } from '../shared/rng/ProvablyFairRNG';

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
  /**
   * Minimum per-tick combustion probability. Default 0.0005 (unchanged behaviour). Previously
   * hard-coded, which made a configured chance of 0 ineffective (R-CLAIM-3).
   */
  combustionFloorPerTick?: number;
  rng?: () => number;
}

const DEFAULT_GRAVITY          = 0.45;
const DEFAULT_FLAP_STRENGTH    = -7.5;
const DEFAULT_PIPE_SPACING     = 200; // Reduced from 230 for faster pipe spawning
const DEFAULT_GAP_HEIGHT       = 120;
const DEFAULT_SCROLL_SPEED     = 3;
const DEFAULT_HOUSE_EDGE       = 0.03;
const DEFAULT_COMBUSTION_CHANCE = 0.0003;
const MULTIPLIER_PER_PIPE      = 1.09;
const DEFAULT_COMBUSTION_FLOOR = 0.0005;
const COMBUSTION_SCALE_PER_PIPE = 0.05;

let fallbackInstance: ProvablyFairRNG | null = null;
/** Shared fallback when no RNG is injected (previously a new generator was built every tick). */
function fallbackRandom(): number {
  if (!fallbackInstance) fallbackInstance = new ProvablyFairRNG();
  return fallbackInstance.random();
}

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
    pipes: [generateFlapPipe(config.worldWidth + 100, config, config.rng)],
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
  const rng              = config.rng              ?? fallbackRandom;

  if (isFlapping) state.playerVelocityY = flapStrength;
  state.playerVelocityY += gravity;
  state.playerY         += state.playerVelocityY;
  state.distanceTravelled += scrollSpeed;

  // Boundary — top = death, bottom = cash out
  const halfH = state.playerHeight / 2;
  if (state.playerY < halfH) {
    // Hit ceiling — crash, no payout
    state.isAlive = false;
    state.payout  = 0;
    return state;
  }
  if (state.playerY > config.worldHeight - halfH) {
    if (state.pipesCleared >= 1) {
      // Flew out the bottom — cash out with current multiplier (only after first gate)
      state.isAlive   = false;
      state.cashedOut = true;
      state.payout    = parseFloat((state.bet * state.multiplier).toFixed(2));
    } else {
      // Hit the floor before first pipe — instant death, no payout
      state.isAlive = false;
      state.payout  = 0;
    }
    return state;
  }

  // Move pipes
  for (const pipe of state.pipes) pipe.x -= scrollSpeed;
  state.pipes = state.pipes.filter(p => p.x > -60);

  // Spawn new pipes
  const lastPipe = state.pipes[state.pipes.length - 1];
  if (!lastPipe || lastPipe.x < config.worldWidth - pipeSpacing) {
    state.pipes.push(generateFlapPipe(config.worldWidth + 60, config, rng));
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

  // Combustion — base 0.05% per tick ensures house edge is felt from frame 1.
  // Scales with pipes cleared so longer runs carry increasing risk.
  const combustionFloor = config.combustionFloorPerTick ?? DEFAULT_COMBUSTION_FLOOR;
  if (rng() < Math.max(combustionFloor, combustionChance * (1 + state.pipesCleared * COMBUSTION_SCALE_PER_PIPE))) {
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
export function generateFlapPipe(spawnX: number, config: FlapFortuneConfig, rng?: () => number): FlapPipe {
  const gapHeight  = config.pipeGapHeight ?? DEFAULT_GAP_HEIGHT;
  const margin     = 70;
  const maxTop     = config.worldHeight - gapHeight - margin;
  // Use provided rng (from game state) to avoid same-millisecond seed bug
  const roll = rng ? rng() : fallbackRandom();
  const topHeight  = margin + roll * (maxTop - margin);
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


// ─── polish-003: deterministic round controller ─────────────────────────────

/** Bump whenever an outcome-affecting rule in the round controller changes. */
export const FLAP_SIM_VERSION = 2;

/** World/player constants the renderer must reuse (never re-derive from art). */
export const FLAP_PLAYER_X = 80;
export const FLAP_PIPE_WIDTH = 30;

/** Why a Flap round ended. */
export type FlapSettlementReason = 'cashout' | 'dive' | 'crash' | 'ceiling' | 'floor' | 'combust';

/** Immutable settlement result. */
export interface FlapSettlement {
  reason: FlapSettlementReason;
  tick: number;
  multiplier: number;
  /** Credits returned (2 dp). */
  payout: number;
  returnHundredths: number;
}

/** Tick input. Only `type` matters to the logic. */
export interface FlapAction { type: string; }

/** A deterministic round: state + its own gameplay RNG + settlement. */
export interface FlapRound {
  readonly seed: string;
  readonly config: FlapFortuneConfig;
  readonly rng: ProvablyFairRNG;
  state: FlapFortuneState;
  tick: number;
  settlement: FlapSettlement | null;
}

/**
 * Creates a seeded round. Gameplay randomness comes only from this round's RNG.
 * @param seed - Round seed (recorded for replay).
 * @param bet - Stake in credits.
 * @param config - Gameplay config (its `rng` field is ignored and replaced).
 * @returns A new round.
 * @example
 * const round = createFlapRound('abc', 10, { worldWidth: 390, worldHeight: 844 });
 */
export function createFlapRound(seed: string, bet: number, config: FlapFortuneConfig): FlapRound {
  const rng = new ProvablyFairRNG(seed, { algorithm: RNG_ALGORITHM_V2 });
  const boundConfig: FlapFortuneConfig = { ...config, rng: () => rng.random() };
  const state = createFlapFortuneState(bet, boundConfig);
  state.playerY = config.worldHeight / 2;
  state.playerVelocityY = 0;
  return { seed, config: boundConfig, rng, state, tick: 0, settlement: null };
}

/**
 * Whether a footer cash-out is accepted right now. Mirrors the dive exit: only after the
 * first cleared gate, only while alive and unsettled.
 * @param round - Round.
 * @returns True if cash-out is allowed.
 * @example
 * canCashOutFlap(round);
 */
export function canCashOutFlap(round: FlapRound): boolean {
  return !round.settlement && round.state.isAlive && !round.state.cashedOut && round.state.pipesCleared >= 1;
}

function settle(round: FlapRound, reason: FlapSettlementReason, payout: number): FlapSettlement {
  const s: FlapSettlement = { reason, tick: round.tick, multiplier: round.state.multiplier, payout, returnHundredths: Math.round(payout * 100) };
  round.settlement = s;
  return s;
}

/**
 * Advances one tick with this tick's actions, in a fixed order:
 * 1. A valid `cashOut` (validated against the state at tick start) settles immediately at the
 *    current multiplier; hazards do not advance (decision D-6 default).
 * 2. Any number of `flap` edges in the tick apply one flap impulse.
 * 3. Physics, pipes, collision and combustion run exactly as `tickFlapFortune`.
 * 4. A terminal state produces exactly one settlement.
 * @param round - Round (mutated).
 * @param actions - Actions stamped for this tick.
 * @returns Whether the round is settled after this tick.
 * @example
 * stepFlapRound(round, [{ type: 'flap' }]);
 */
export function stepFlapRound(round: FlapRound, actions: readonly FlapAction[]): { settled: boolean } {
  if (round.settlement) return { settled: true };
  if (actions.some((a) => a.type === 'cashOut') && canCashOutFlap(round)) {
    const payout = cashOutFlapFortune(round.state);
    settle(round, 'cashout', payout);
    return { settled: true };
  }
  const flapping = actions.some((a) => a.type === 'flap');
  const before = round.state.pipesCleared;
  tickFlapFortune(round.state, flapping, round.config);
  round.tick++;
  const st = round.state;
  if (!st.isAlive) {
    const halfH = st.playerHeight / 2;
    let reason: FlapSettlementReason;
    if (st.cashedOut) reason = 'dive';
    else if (st.combusted) reason = 'combust';
    else if (st.playerY < halfH) reason = 'ceiling';
    else if (st.playerY > round.config.worldHeight - halfH && before < 1) reason = 'floor';
    else reason = 'crash';
    settle(round, reason, st.cashedOut ? st.payout : 0);
    return { settled: true };
  }
  return { settled: false };
}

/** Serializable checkpoint of a Flap round. */
export interface FlapCheckpoint {
  simVersion: number;
  seed: string;
  tick: number;
  state: FlapFortuneState;
  rng: RNGStateSnapshot;
  settlement: FlapSettlement | null;
}

/**
 * Captures a JSON-safe checkpoint.
 * @param round - Round.
 * @returns Checkpoint.
 * @example
 * const cp = checkpointFlapRound(round);
 */
export function checkpointFlapRound(round: FlapRound): FlapCheckpoint {
  return JSON.parse(JSON.stringify({ simVersion: FLAP_SIM_VERSION, seed: round.seed, tick: round.tick, state: round.state, rng: round.rng.getState(), settlement: round.settlement })) as FlapCheckpoint;
}

/**
 * Restores a round from a checkpoint.
 * @param cp - Checkpoint.
 * @param config - The same gameplay config used originally.
 * @returns Round continuing exactly where the checkpoint left off.
 * @throws On simVersion mismatch.
 * @example
 * const round = restoreFlapRound(cp, config);
 */
export function restoreFlapRound(cp: FlapCheckpoint, config: FlapFortuneConfig): FlapRound {
  if (cp.simVersion !== FLAP_SIM_VERSION) throw new Error(`Flap checkpoint simVersion ${cp.simVersion} != ${FLAP_SIM_VERSION}`);
  const round = createFlapRound(cp.seed, cp.state.bet, config);
  round.rng.setState(cp.rng);
  round.state = JSON.parse(JSON.stringify(cp.state)) as FlapFortuneState;
  round.tick = cp.tick;
  round.settlement = cp.settlement ? { ...cp.settlement } : null;
  return round;
}
