/**
 * @file DoomCrashLogic.ts
 * @purpose Pure game logic for Doom Crash 2.0 - zero Phaser imports
 * @author Agent 934
 * @date 2026-04-24
 * @license Proprietary — available for licensing
 */

export const BASE_MULTIPLIER = 1.0;
export const MULTIPLIER_TICK_RATE_MS = 100;
export const MULTIPLIER_GROWTH_RATE = 0.03;
export const MAX_THEORETICAL_MULTIPLIER = 100;
export const HOUSE_EDGE = 0.04;
export const RTP = 0.96;
export const BASE_CRASH_PROBABILITY_PER_TICK = 0.016; // tuned: 96.1% RTP (20k sim)
export const CRASH_PROBABILITY_SCALE = 0.007; // tuned: 96.1% RTP (20k sim)
export const MIN_CRASH_MULTIPLIER = 1.01;
export const ENEMY_SPAWN_INTERVAL_MS = 1200;
export const ENEMY_HIT_WINDOW_MS = 800;
export const ACCURACY_BONUS_PER_HIT = 0.008;
export const MISSED_SHOT_PENALTY = 0.003;
export const MAX_ACTIVE_ENEMIES = 5;
export const SIMULATION_ROUNDS = 100000;

export type EnemyType = "IMP" | "DEMON" | "CACODEMON" | "CYBERDEMON";

export interface Enemy {
    id: string;
    type: EnemyType;
    spawnedAt: number;
    hitWindowEnd: number;
    isAlive: boolean;
    depth: number;
    threatMultiplierOnMiss: number;
}

export interface DoomCrashState {
    isRunning: boolean;
    isCrashed: boolean;
    isCashedOut: boolean;
    currentMultiplier: number;
    crashMultiplier: number | null;
    cashedOutAt: number | null;
    betAmount: number;
    sessionStartTime: number;
    currentTime: number;
    activeEnemies: Enemy[];
    shotsFired: number;
    shotsHit: number;
    accuracyBonus: number;
    crashProbabilityAccumulator: number;
}

export interface SessionResult {
    crashed: boolean;
    multiplier: number;
    payout: number;
    shotsFired: number;
    shotsHit: number;
    accuracy: number;
}

export interface RTPSimulationResult {
    simulatedRTP: number;
    averageMultiplier: number;
    crashDistribution: Record<string, number>;
    averageAccuracy: number;
}
/**
 * Creates an initial state for the Doom Crash game.
 * @param betAmount The initial bet amount for the session.
 * @returns A fresh DoomCrashState object.
 */
export function createInitialState(betAmount: number): DoomCrashState {
    return {
        isRunning: false,
        isCrashed: false,
        isCashedOut: false,
        currentMultiplier: BASE_MULTIPLIER,
        crashMultiplier: null,
        cashedOutAt: null,
        betAmount: betAmount,
        sessionStartTime: 0,
        currentTime: 0,
        activeEnemies: [],
        shotsFired: 0,
        shotsHit: 0,
        accuracyBonus: 0,
        crashProbabilityAccumulator: 0,
    };
}

/**
 * Starts a Doom Crash game session.
 * @param state The current game state.
 * @param rng An object with a nextFloat() method for generating random numbers.
 * @param nowMs The current timestamp in milliseconds.
 * @returns The updated game state with the session started.
 */
export function startSession(state: DoomCrashState, _rng: { nextFloat(): number }, nowMs: number): DoomCrashState {
    return {
        ...state,
        isRunning: true,
        sessionStartTime: nowMs,
        currentTime: nowMs,
        currentMultiplier: BASE_MULTIPLIER,
        isCrashed: false,
        isCashedOut: false,
        crashMultiplier: null,
        cashedOutAt: null,
        activeEnemies: [],
        shotsFired: 0,
        shotsHit: 0,
        accuracyBonus: 0,
        crashProbabilityAccumulator: 0,
    };
}

/**
 * Spawns a new enemy based on the current multiplier.
 * @param rng An object with a nextFloat() method for generating random numbers.
 * @param nowMs The current timestamp in milliseconds.
 * @param currentMultiplier The current game multiplier.
 * @returns A new Enemy object.
 */
export function spawnEnemy(rng: { nextFloat(): number }, nowMs: number, currentMultiplier: number): Enemy {
    let type: EnemyType;
    let threatMultiplierOnMiss: number;

    if (currentMultiplier >= 25) {
        type = "CYBERDEMON";
        threatMultiplierOnMiss = 0.05;
    } else if (currentMultiplier >= 10) {
        type = rng.nextFloat() < 0.7 ? "CYBERDEMON" : "CACODEMON";
        threatMultiplierOnMiss = type === "CYBERDEMON" ? 0.05 : 0.03;
    } else if (currentMultiplier >= 5) {
        type = rng.nextFloat() < 0.6 ? "CACODEMON" : "DEMON";
        threatMultiplierOnMiss = type === "CACODEMON" ? 0.03 : 0.015;
    } else if (currentMultiplier >= 2) {
        type = rng.nextFloat() < 0.5 ? "DEMON" : "IMP";
        threatMultiplierOnMiss = type === "DEMON" ? 0.015 : 0.005;
    } else {
        type = "IMP";
        threatMultiplierOnMiss = 0.005;
    }

    return {
        id: `${nowMs}-${Math.floor(rng.nextFloat() * 10000)}`,
        type: type,
        spawnedAt: nowMs,
        hitWindowEnd: nowMs + ENEMY_HIT_WINDOW_MS,
        isAlive: true,
        depth: 0.0, // Initial depth
        threatMultiplierOnMiss: threatMultiplierOnMiss,
    };
}

/**
 * Computes the current probability of the game crashing.
 * @param state The current game state.
 * @returns The crash probability, clamped between 0.001 and 0.95.
 */
export function computeCrashProbability(state: DoomCrashState): number {
    let probability =
        BASE_CRASH_PROBABILITY_PER_TICK +
        state.currentMultiplier * CRASH_PROBABILITY_SCALE +
        state.crashProbabilityAccumulator -
        state.accuracyBonus;

    // Clamp the result
    return Math.max(0.001, Math.min(0.95, probability));
}

/**
 * Advances the game state by one tick.
 * @param state The current game state.
 * @param rng An object with a nextFloat() method for generating random numbers.
 * @param nowMs The current timestamp in milliseconds.
 * @returns The updated game state after the tick.
 */
export function tick(state: DoomCrashState, rng: { nextFloat(): number }, nowMs: number): DoomCrashState {
    if (!state.isRunning || state.isCrashed || state.isCashedOut) {
        return state;
    }

    let newState = { ...state, currentTime: nowMs };

    // 1. Grow multiplier
    newState.currentMultiplier = Math.min(
        MAX_THEORETICAL_MULTIPLIER,
        newState.currentMultiplier * (1 + MULTIPLIER_GROWTH_RATE)
    );

    // 2. Check crash
    const crashProbability = computeCrashProbability(newState);
    if (newState.currentMultiplier >= MIN_CRASH_MULTIPLIER && rng.nextFloat() < crashProbability) {
        newState.isCrashed = true;
        newState.crashMultiplier = newState.currentMultiplier;
        newState.isRunning = false;
        return newState;
    }

    // 3. Spawn enemy
    const timeElapsedSinceStart = nowMs - newState.sessionStartTime;
    const shouldSpawn =
        timeElapsedSinceStart % ENEMY_SPAWN_INTERVAL_MS < MULTIPLIER_TICK_RATE_MS &&
        newState.activeEnemies.length < MAX_ACTIVE_ENEMIES;

    if (shouldSpawn) {
        const newEnemy = spawnEnemy(rng, nowMs, newState.currentMultiplier);
        newState.activeEnemies = [...newState.activeEnemies, newEnemy];
    }

    // 4. Age out enemies
    const newActiveEnemies = [];
    let accumulatedThreat = newState.crashProbabilityAccumulator;
    for (const enemy of newState.activeEnemies) {
        if (enemy.hitWindowEnd < nowMs) {
            // Window expired — add threat only if enemy was never killed
            if (enemy.isAlive) {
                accumulatedThreat += enemy.threatMultiplierOnMiss;
            }
            // Either way, remove from active list
        } else {
            newActiveEnemies.push(enemy);
        }
    }
    newState.activeEnemies = newActiveEnemies;
    newState.crashProbabilityAccumulator = accumulatedThreat;

    return newState;
}

/**
 * Simulates a player shooting at an enemy.
 * @param state The current game state.
 * @param targetEnemyId The ID of the enemy being targeted.
 * @param nowMs The current timestamp in milliseconds.
 * @returns The updated game state after the shot.
 */
export function shoot(state: DoomCrashState, targetEnemyId: string, nowMs: number): DoomCrashState {
    if (!state.isRunning || state.isCrashed || state.isCashedOut) {
        return state;
    }

    let newState = { ...state, shotsFired: state.shotsFired + 1 };
    let enemyFoundAndHit = false;

    newState.activeEnemies = newState.activeEnemies.map((enemy) => {
        if (enemy.id === targetEnemyId && enemy.isAlive) {
            if (nowMs <= enemy.hitWindowEnd) {
                // Hit!
                enemyFoundAndHit = true;
                return { ...enemy, isAlive: false };
            }
        }
        return enemy;
    });

    if (enemyFoundAndHit) {
        newState.shotsHit += 1;
        newState.accuracyBonus += ACCURACY_BONUS_PER_HIT;
    } else {
        newState.crashProbabilityAccumulator += MISSED_SHOT_PENALTY;
    }

    return newState;
}

/**
 * Cashes out the player's bet.
 * @param state The current game state.
 * @returns The updated game state after cashing out.
 */
export function cashOut(state: DoomCrashState): DoomCrashState {
    if (!state.isRunning || state.isCrashed || state.isCashedOut) {
        return state;
    }

    return {
        ...state,
        isCashedOut: true,
        cashedOutAt: state.currentMultiplier,
        isRunning: false,
    };
}

/**
 * Retrieves the final result of a game session.
 * @param state The final game state.
 * @returns An object detailing the session's outcome.
 */
export function getSessionResult(state: DoomCrashState): SessionResult {
    const crashed = state.isCrashed;
    const multiplier = crashed ? state.crashMultiplier ?? 0 : state.cashedOutAt ?? 1;
    const payout = crashed ? 0 : state.betAmount * multiplier;
    const accuracy = state.shotsFired > 0 ? state.shotsHit / state.shotsFired : 0;

    return {
        crashed: crashed,
        multiplier: multiplier,
        payout: payout,
        shotsFired: state.shotsFired,
        shotsHit: state.shotsHit,
        accuracy: accuracy,
    };
}

/**
 * Simulates multiple rounds of the Doom Crash game to calculate theoretical RTP.
 * This simulation includes a simplified player strategy for accuracy and cash-out.
 * @param rng An object with a nextFloat() method for generating random numbers.
 * @param rounds The number of simulation rounds to run. Defaults to SIMULATION_ROUNDS.
 * @returns An RTPSimulationResult object containing simulation statistics.
 */
export function simulateDoomCrashRTP(rng: { nextFloat(): number }, rounds = SIMULATION_ROUNDS): RTPSimulationResult {
    let totalPayout = 0;
    let totalBet = 0;
    let totalMultiplier = 0;
    let totalAccuracy = 0;

    const crashDistribution: Record<string, number> = {
        '1x': 0,
        '2x': 0,
        '5x': 0,
        '10x': 0,
        '25x+': 0,
    };

    const BET_AMOUNT = 100;

    for (let i = 0; i < rounds; i++) {
        totalBet += BET_AMOUNT;

        let state = createInitialState(BET_AMOUNT);
        let nowMs = 0;
        state = startSession(state, rng, nowMs);

        // Simulate a random player accuracy for this session (0.3–0.8)
        const sessionAccuracyTarget = 0.3 + rng.nextFloat() * 0.5;
        // Simulate auto-cashout target (1.5x–5x)
        const cashOutTarget = 1.5 + rng.nextFloat() * 3.5;

        while (state.isRunning && state.currentMultiplier < MAX_THEORETICAL_MULTIPLIER) {
            nowMs += MULTIPLIER_TICK_RATE_MS;

            // Simulate shooting at active enemies via shoot() — no direct state mutation
            const activeAliveEnemies = state.activeEnemies.filter(
                e => e.isAlive && nowMs <= e.hitWindowEnd
            );
            for (const enemy of activeAliveEnemies) {
                // shoot() handles shotsFired, shotsHit, accuracyBonus, and missed penalty internally
                if (rng.nextFloat() < sessionAccuracyTarget) {
                    state = shoot(state, enemy.id, nowMs);
                } else {
                    // Fire at enemy but miss — use a non-existent ID to trigger miss path
                    state = shoot(state, `miss-${enemy.id}`, nowMs);
                }
            }

            state = tick(state, rng, nowMs);

            if (state.isRunning && state.currentMultiplier >= cashOutTarget) {
                state = cashOut(state);
            }
        }

        const result = getSessionResult(state);
        totalPayout += result.payout;
        totalMultiplier += result.multiplier;
        totalAccuracy += result.accuracy;

        const m = result.multiplier;
        if (m < 2) crashDistribution['1x']++;
        else if (m < 5) crashDistribution['2x']++;
        else if (m < 10) crashDistribution['5x']++;
        else if (m < 25) crashDistribution['10x']++;
        else crashDistribution['25x+']++;
    }

    return {
        simulatedRTP: totalBet > 0 ? totalPayout / totalBet : 0,
        averageMultiplier: rounds > 0 ? totalMultiplier / rounds : 0,
        crashDistribution,
        averageAccuracy: rounds > 0 ? totalAccuracy / rounds : 0,
    };
}
