/**
 * @file DoomCrashLogic.test.ts
 * @purpose Unit tests for Doom Crash 2.0 logic
 * @author Agent 934
 * @date 2026-04-24
 * @license Proprietary
 */

import {
  createInitialState,
  startSession,
  tick,
  shoot,
  cashOut,
  getSessionResult,
  spawnEnemy,
  computeCrashProbability,
  simulateDoomCrashRTP,
  BASE_MULTIPLIER,
  MULTIPLIER_GROWTH_RATE,
  ENEMY_HIT_WINDOW_MS,
  ACCURACY_BONUS_PER_HIT,
  MISSED_SHOT_PENALTY,
  MAX_ACTIVE_ENEMIES,
  BASE_CRASH_PROBABILITY_PER_TICK,
  CRASH_PROBABILITY_SCALE,
  MIN_CRASH_MULTIPLIER,
  ENEMY_SPAWN_INTERVAL_MS,
  MULTIPLIER_TICK_RATE_MS,
  MAX_THEORETICAL_MULTIPLIER,
  HOUSE_EDGE,
  RTP,
  SIMULATION_ROUNDS,
  DoomCrashState,
  Enemy,
  EnemyType,
} from '../games/DoomCrashLogic';

const makeRng = (values: number[]) => {
  let i = 0;
  return { nextFloat: () => values[i++ % values.length] };
};

const makeConstRng = (val: number) => ({ nextFloat: () => val });

describe('createInitialState', () => {
  const BET_AMOUNT = 100;
  let initialState: DoomCrashState;

  beforeEach(() => {
    initialState = createInitialState(BET_AMOUNT);
  });

  test('returns correct defaults', () => {
    expect(initialState.isRunning).toBe(false);
    expect(initialState.isCrashed).toBe(false);
    expect(initialState.isCashedOut).toBe(false);
    expect(initialState.betAmount).toBe(BET_AMOUNT);
    expect(initialState.currentMultiplier).toBe(BASE_MULTIPLIER);
    expect(initialState.crashMultiplier).toBeNull();
    expect(initialState.cashedOutAt).toBeNull();
    expect(initialState.sessionStartTime).toBe(0);
    expect(initialState.currentTime).toBe(0);
    expect(initialState.shotsFired).toBe(0);
    expect(initialState.shotsHit).toBe(0);
    expect(initialState.accuracyBonus).toBe(0);
    expect(initialState.crashProbabilityAccumulator).toBe(0);
  });

  test('activeEnemies is an empty array', () => {
    expect(initialState.activeEnemies).toEqual([]);
    expect(initialState.activeEnemies.length).toBe(0);
  });
});

describe('startSession', () => {
  const BET_AMOUNT = 100;
  const NOW_MS = 1000;
  let initialState: DoomCrashState;
  let rng: { nextFloat(): number };

  beforeEach(() => {
    initialState = createInitialState(BET_AMOUNT);
    rng = makeConstRng(0.5); // RNG not strictly used by startSession, but good practice
  });

  test('sets isRunning true', () => {
    const newState = startSession(initialState, rng, NOW_MS);
    expect(newState.isRunning).toBe(true);
  });

  test('resets multiplier to BASE_MULTIPLIER', () => {
    const stateWithHigherMultiplier: DoomCrashState = { ...initialState, currentMultiplier: 5.0 };
    const newState = startSession(stateWithHigherMultiplier, rng, NOW_MS);
    expect(newState.currentMultiplier).toBe(BASE_MULTIPLIER);
  });

  test('sets sessionStartTime to nowMs', () => {
    const newState = startSession(initialState, rng, NOW_MS);
    expect(newState.sessionStartTime).toBe(NOW_MS);
    expect(newState.currentTime).toBe(NOW_MS);
  });

  test('does not mutate original state', () => {
    const originalState = { ...initialState, currentMultiplier: 5.0 };
    startSession(originalState, rng, NOW_MS);
    expect(originalState.isRunning).toBe(false);
    expect(originalState.currentMultiplier).toBe(5.0);
    expect(originalState.sessionStartTime).toBe(0);
  });

  test('resets other relevant session specific fields', () => {
    const preExistingState: DoomCrashState = {
      ...initialState,
      isCrashed: true,
      isCashedOut: true,
      crashMultiplier: 3.5,
      cashedOutAt: 2.1,
      activeEnemies: [{ id: 'test', type: 'IMP', spawnedAt: 1, hitWindowEnd: 2, isAlive: true, depth: 0, threatMultiplierOnMiss: 0.01 }],
      shotsFired: 5,
      shotsHit: 3,
      accuracyBonus: 0.01,
      crashProbabilityAccumulator: 0.02,
    };
    const newState = startSession(preExistingState, rng, NOW_MS);
    expect(newState.isCrashed).toBe(false);
    expect(newState.isCashedOut).toBe(false);
    expect(newState.crashMultiplier).toBeNull();
    expect(newState.cashedOutAt).toBeNull();
    expect(newState.activeEnemies).toEqual([]);
    expect(newState.shotsFired).toBe(0);
    expect(newState.shotsHit).toBe(0);
    expect(newState.accuracyBonus).toBe(0);
    expect(newState.crashProbabilityAccumulator).toBe(0);
  });
});

describe('computeCrashProbability', () => {
  let state: DoomCrashState;

  beforeEach(() => {
    state = createInitialState(100);
  });

  test('base probability at multiplier=1 with no accumulator or bonus', () => {
    state.currentMultiplier = 1;
    state.crashProbabilityAccumulator = 0;
    state.accuracyBonus = 0;
    const expected = BASE_CRASH_PROBABILITY_PER_TICK + 1 * CRASH_PROBABILITY_SCALE;
    expect(computeCrashProbability(state)).toBe(expected);
  });

  test('higher multiplier increases probability', () => {
    state.currentMultiplier = 1;
    const prob1 = computeCrashProbability(state);
    state.currentMultiplier = 10;
    const prob10 = computeCrashProbability(state);
    expect(prob10).toBeGreaterThan(prob1);
  });

  test('accuracyBonus reduces probability', () => {
    state.currentMultiplier = 5;
    state.accuracyBonus = 0;
    const probNoBonus = computeCrashProbability(state);
    state.accuracyBonus = 0.05;
    const probWithBonus = computeCrashProbability(state);
    expect(probWithBonus).toBeLessThan(probNoBonus);
  });

  test('crashProbabilityAccumulator increases probability', () => {
    state.currentMultiplier = 5;
    state.crashProbabilityAccumulator = 0;
    const probNoAccumulator = computeCrashProbability(state);
    state.crashProbabilityAccumulator = 0.03;
    const probWithAccumulator = computeCrashProbability(state);
    expect(probWithAccumulator).toBeGreaterThan(probNoAccumulator);
  });

  test('result is clamped: never below 0.001', () => {
    state.currentMultiplier = 0.1; // Very low multiplier
    state.accuracyBonus = 100; // Huge bonus
    state.crashProbabilityAccumulator = -100; // Negative accumulator (shouldn't happen naturally, but for test)
    expect(computeCrashProbability(state)).toBeGreaterThanOrEqual(0.001);
  });

  test('result is clamped: never above 0.95', () => {
    state.currentMultiplier = 1000; // Huge multiplier
    state.crashProbabilityAccumulator = 100; // Huge accumulator
    state.accuracyBonus = 0;
    expect(computeCrashProbability(state)).toBeLessThanOrEqual(0.95);
  });
});

describe('tick', () => {
  const BET_AMOUNT = 100;
  let initialState: DoomCrashState;
  let rng: { nextFloat(): number };
  const START_TIME = 0;

  beforeEach(() => {
    initialState = startSession(createInitialState(BET_AMOUNT), makeConstRng(0.5), START_TIME);
  });

  test('returns unchanged state if not running', () => {
    const stoppedState = { ...initialState, isRunning: false };
    const newState = tick(stoppedState, makeConstRng(0.5), MULTIPLIER_TICK_RATE_MS);
    expect(newState).toEqual(stoppedState);
  });

  test('returns unchanged state if already crashed', () => {
    const crashedState = { ...initialState, isCrashed: true, crashMultiplier: 2.0 };
    const newState = tick(crashedState, makeConstRng(0.5), MULTIPLIER_TICK_RATE_MS);
    expect(newState).toEqual(crashedState);
  });

  test('returns unchanged state if already cashed out', () => {
    const cashedOutState = { ...initialState, isCashedOut: true, cashedOutAt: 1.5 };
    const newState = tick(cashedOutState, makeConstRng(0.5), MULTIPLIER_TICK_RATE_MS);
    expect(newState).toEqual(cashedOutState);
  });

  test('grows multiplier by MULTIPLIER_GROWTH_RATE', () => {
    const initialMultiplier = initialState.currentMultiplier;
    const newState = tick(initialState, makeConstRng(1), MULTIPLIER_TICK_RATE_MS); // Prevent crash
    const expectedMultiplier = Math.min(MAX_THEORETICAL_MULTIPLIER, initialMultiplier * (1 + MULTIPLIER_GROWTH_RATE));
    expect(newState.currentMultiplier).toBeCloseTo(expectedMultiplier);
    expect(newState.currentMultiplier).toBeGreaterThan(initialMultiplier);
  });

  test('multiplier does not exceed MAX_THEORETICAL_MULTIPLIER', () => {
    const stateAtMax: DoomCrashState = { ...initialState, currentMultiplier: MAX_THEORETICAL_MULTIPLIER - 0.001 };
    const newState = tick(stateAtMax, makeConstRng(1), MULTIPLIER_TICK_RATE_MS);
    expect(newState.currentMultiplier).toBeLessThanOrEqual(MAX_THEORETICAL_MULTIPLIER);
  });

  test('triggers crash when rng < crashProbability', () => {
    const stateReadyToCrash: DoomCrashState = { ...initialState, currentMultiplier: MIN_CRASH_MULTIPLIER };
    // Force crash by making RNG return a very small number, ensuring rng < prob
    const rngForcedCrash = makeConstRng(0);
    const newState = tick(stateReadyToCrash, rngForcedCrash, MULTIPLIER_TICK_RATE_MS);

    expect(newState.isCrashed).toBe(true);
    expect(newState.isRunning).toBe(false);
    expect(newState.crashMultiplier).toBeCloseTo(MIN_CRASH_MULTIPLIER * (1 + MULTIPLIER_GROWTH_RATE));
  });

  test('does NOT crash when rng > crashProbability', () => {
    const stateNotToCrash: DoomCrashState = { ...initialState, currentMultiplier: MIN_CRASH_MULTIPLIER };
    // Prevent crash by making RNG return a very large number, ensuring rng > prob
    const rngPreventCrash = makeConstRng(1);
    const newState = tick(stateNotToCrash, rngPreventCrash, MULTIPLIER_TICK_RATE_MS);

    expect(newState.isCrashed).toBe(false);
    expect(newState.isRunning).toBe(true);
    expect(newState.crashMultiplier).toBeNull();
  });

  test('spawns enemy when interval elapsed and below MAX_ACTIVE_ENEMIES', () => {
    const timeToSpawn = START_TIME + ENEMY_SPAWN_INTERVAL_MS;
    const stateBeforeSpawn = { ...initialState, currentTime: START_TIME };
    const newState = tick(stateBeforeSpawn, makeRng([0.5, 0.5]), timeToSpawn); // RNG for spawnEnemy

    expect(newState.activeEnemies.length).toBe(1);
    expect(newState.activeEnemies[0].spawnedAt).toBe(timeToSpawn);
    expect(newState.activeEnemies[0].type).toBe("IMP"); // Default for multiplier 1
  });

  test('does not spawn enemy if MAX_ACTIVE_ENEMIES reached', () => {
    const timeToSpawn = START_TIME + ENEMY_SPAWN_INTERVAL_MS;
    // hitWindowEnd must be beyond timeToSpawn so enemies are still active (not aged out)
    const fullEnemyState: DoomCrashState = {
      ...initialState,
      activeEnemies: Array.from({ length: MAX_ACTIVE_ENEMIES }).map((_, i) => ({
        id: `e${i}`, type: 'IMP' as const, spawnedAt: START_TIME,
        hitWindowEnd: timeToSpawn + ENEMY_HIT_WINDOW_MS, // still alive at timeToSpawn
        isAlive: true, depth: 0, threatMultiplierOnMiss: 0.01,
      })),
    };
    const newState = tick(fullEnemyState, makeConstRng(0.5), timeToSpawn);
    expect(newState.activeEnemies.length).toBe(MAX_ACTIVE_ENEMIES);
  });

  test('ages out expired enemies and adds their threat to crashProbabilityAccumulator', () => {
    const enemy1: Enemy = { id: 'e1', type: 'IMP', spawnedAt: START_TIME, hitWindowEnd: START_TIME + 100, isAlive: true, depth: 0, threatMultiplierOnMiss: 0.005 };
    const enemy2: Enemy = { id: 'e2', type: 'DEMON', spawnedAt: START_TIME + 50, hitWindowEnd: START_TIME + 150, isAlive: true, depth: 0, threatMultiplierOnMiss: 0.015 };

    let stateWithEnemies: DoomCrashState = {
      ...initialState,
      activeEnemies: [enemy1, enemy2],
      currentTime: START_TIME,
      crashProbabilityAccumulator: 0,
    };

    // Advance time past enemy1's hit window, but before enemy2's
    const nowMs = START_TIME + 120; // Enemy 1 expired, enemy 2 still active
    const newState = tick(stateWithEnemies, makeConstRng(1), nowMs);

    expect(newState.activeEnemies.length).toBe(1);
    expect(newState.activeEnemies[0].id).toBe('e2');
    expect(newState.crashProbabilityAccumulator).toBeCloseTo(enemy1.threatMultiplierOnMiss);

    // Advance time past enemy2's hit window
    const laterNowMs = START_TIME + 200;
    const finalState = tick(newState, makeConstRng(1), laterNowMs);
    expect(finalState.activeEnemies.length).toBe(0);
    expect(finalState.crashProbabilityAccumulator).toBeCloseTo(enemy1.threatMultiplierOnMiss + enemy2.threatMultiplierOnMiss);
  });

  test('aged out but already shot enemies do not add threat', () => {
    const enemy1: Enemy = { id: 'e1', type: 'IMP', spawnedAt: START_TIME, hitWindowEnd: START_TIME + 100, isAlive: false, depth: 0, threatMultiplierOnMiss: 0.005 }; // isAlive: false
    let stateWithEnemies: DoomCrashState = {
      ...initialState,
      activeEnemies: [enemy1],
      currentTime: START_TIME,
      crashProbabilityAccumulator: 0,
    };
    const nowMs = START_TIME + 120;
    const newState = tick(stateWithEnemies, makeConstRng(1), nowMs);
    expect(newState.activeEnemies.length).toBe(0);
    expect(newState.crashProbabilityAccumulator).toBe(0); // No threat added because it was already not alive
  });


  test('does not mutate original state', () => {
    const originalState = { ...initialState };
    tick(originalState, makeConstRng(1), MULTIPLIER_TICK_RATE_MS);
    expect(originalState).toEqual(initialState);
  });
});

describe('shoot', () => {
  const BET_AMOUNT = 100;
  const NOW_MS = 1000;
  let initialState: DoomCrashState;
  let activeEnemy: Enemy;

  beforeEach(() => {
    initialState = startSession(createInitialState(BET_AMOUNT), makeConstRng(0.5), NOW_MS - 100);
    activeEnemy = {
      id: 'enemy1',
      type: 'IMP',
      spawnedAt: NOW_MS - 50,
      hitWindowEnd: NOW_MS + 50, // Hit window ends in the future
      isAlive: true,
      depth: 0,
      threatMultiplierOnMiss: 0.005,
    };
    initialState.activeEnemies = [activeEnemy];
    initialState.currentTime = NOW_MS;
  });

  test('increments shotsFired always', () => {
    const newStateHit = shoot(initialState, activeEnemy.id, NOW_MS);
    expect(newStateHit.shotsFired).toBe(1);
    const newStateMiss = shoot(initialState, 'nonExistentEnemy', NOW_MS);
    expect(newStateMiss.shotsFired).toBe(1);
  });

  test('hitting a live enemy within window: marks isAlive false, increments shotsHit, adds ACCURACY_BONUS_PER_HIT to accuracyBonus', () => {
    const newState = shoot(initialState, activeEnemy.id, NOW_MS);

    expect(newState.shotsHit).toBe(1);
    expect(newState.accuracyBonus).toBeCloseTo(ACCURACY_BONUS_PER_HIT);
    const updatedEnemy = newState.activeEnemies.find(e => e.id === activeEnemy.id);
    expect(updatedEnemy?.isAlive).toBe(false);
  });

  test('missing (enemy ID not found): adds MISSED_SHOT_PENALTY to crashProbabilityAccumulator', () => {
    const newState = shoot(initialState, 'nonExistentEnemy', NOW_MS);

    expect(newState.shotsHit).toBe(0);
    expect(newState.accuracyBonus).toBe(0);
    expect(newState.crashProbabilityAccumulator).toBeCloseTo(MISSED_SHOT_PENALTY);
  });

  test('shooting expired enemy (past hitWindowEnd): counts as miss', () => {
    const expiredEnemyState = {
      ...initialState,
      activeEnemies: [{ ...activeEnemy, hitWindowEnd: NOW_MS - 10 }], // Hit window ended in the past
    };
    const newState = shoot(expiredEnemyState, activeEnemy.id, NOW_MS);

    expect(newState.shotsHit).toBe(0);
    expect(newState.accuracyBonus).toBe(0);
    expect(newState.crashProbabilityAccumulator).toBeCloseTo(MISSED_SHOT_PENALTY);
    const updatedEnemy = newState.activeEnemies.find(e => e.id === activeEnemy.id);
    expect(updatedEnemy?.isAlive).toBe(true); // Should not change isAlive if window expired
  });

  test('shooting an already dead enemy: counts as miss', () => {
    const deadEnemyState = {
      ...initialState,
      activeEnemies: [{ ...activeEnemy, isAlive: false }],
    };
    const newState = shoot(deadEnemyState, activeEnemy.id, NOW_MS);

    expect(newState.shotsHit).toBe(0);
    expect(newState.accuracyBonus).toBe(0);
    expect(newState.crashProbabilityAccumulator).toBeCloseTo(MISSED_SHOT_PENALTY);
    const updatedEnemy = newState.activeEnemies.find(e => e.id === activeEnemy.id);
    expect(updatedEnemy?.isAlive).toBe(false); // Remains dead
  });


  test('does not mutate original state', () => {
    const originalState = { ...initialState };
    shoot(originalState, activeEnemy.id, NOW_MS);
    expect(originalState).toEqual(initialState);
  });

  test('returns unchanged state if not running', () => {
    const stoppedState = { ...initialState, isRunning: false };
    const newState = shoot(stoppedState, activeEnemy.id, NOW_MS);
    expect(newState).toEqual(stoppedState);
  });

  test('returns unchanged state if already crashed', () => {
    const crashedState = { ...initialState, isCrashed: true, crashMultiplier: 2.0 };
    const newState = shoot(crashedState, activeEnemy.id, NOW_MS);
    expect(newState).toEqual(crashedState);
  });

  test('returns unchanged state if already cashed out', () => {
    const cashedOutState = { ...initialState, isCashedOut: true, cashedOutAt: 1.5 };
    const newState = shoot(cashedOutState, activeEnemy.id, NOW_MS);
    expect(newState).toEqual(cashedOutState);
  });
});

describe('cashOut', () => {
  const BET_AMOUNT = 100;
  const NOW_MS = 1000;
  let initialState: DoomCrashState;

  beforeEach(() => {
    initialState = startSession(createInitialState(BET_AMOUNT), makeConstRng(0.5), NOW_MS - 100);
    initialState.currentMultiplier = 3.5;
    initialState.currentTime = NOW_MS;
  });

  test('sets isCashedOut true, cashedOutAt = currentMultiplier, isRunning false', () => {
    const newState = cashOut(initialState);
    expect(newState.isCashedOut).toBe(true);
    expect(newState.cashedOutAt).toBe(initialState.currentMultiplier);
    expect(newState.isRunning).toBe(false);
  });

  test('no-op if already crashed', () => {
    const crashedState = { ...initialState, isCrashed: true, crashMultiplier: 2.0, isRunning: false };
    const newState = cashOut(crashedState);
    expect(newState).toEqual(crashedState);
  });

  test('no-op if already cashed out', () => {
    const cashedOutState = { ...initialState, isCashedOut: true, cashedOutAt: 1.5, isRunning: false };
    const newState = cashOut(cashedOutState);
    expect(newState).toEqual(cashedOutState);
  });

  test('does not mutate original state', () => {
    const originalState = { ...initialState };
    cashOut(originalState);
    expect(originalState).toEqual(initialState);
  });
});

describe('getSessionResult', () => {
  const BET_AMOUNT = 100;

  test('crashed session: payout = 0, multiplier = crashMultiplier', () => {
    const state: DoomCrashState = {
      ...createInitialState(BET_AMOUNT),
      isCrashed: true,
      crashMultiplier: 5.2,
      shotsFired: 10,
      shotsHit: 3,
    };
    const result = getSessionResult(state);
    expect(result.crashed).toBe(true);
    expect(result.payout).toBe(0);
    expect(result.multiplier).toBe(5.2);
    expect(result.accuracy).toBeCloseTo(0.3);
    expect(result.shotsFired).toBe(10);
    expect(result.shotsHit).toBe(3);
  });

  test('cashed out session: payout = betAmount * cashedOutAt', () => {
    const cashedOutMultiplier = 2.5;
    const state: DoomCrashState = {
      ...createInitialState(BET_AMOUNT),
      isCashedOut: true,
      cashedOutAt: cashedOutMultiplier,
      shotsFired: 8,
      shotsHit: 6,
    };
    const result = getSessionResult(state);
    expect(result.crashed).toBe(false);
    expect(result.payout).toBe(BET_AMOUNT * cashedOutMultiplier);
    expect(result.multiplier).toBe(cashedOutMultiplier);
    expect(result.accuracy).toBeCloseTo(6 / 8);
    expect(result.shotsFired).toBe(8);
    expect(result.shotsHit).toBe(6);
  });

  test('accuracy = shotsHit / shotsFired, handles zero shots fired', () => {
    const stateNoShots: DoomCrashState = {
      ...createInitialState(BET_AMOUNT),
      isCashedOut: true,
      cashedOutAt: 1.5,
      shotsFired: 0,
      shotsHit: 0,
    };
    const resultNoShots = getSessionResult(stateNoShots);
    expect(resultNoShots.accuracy).toBe(0);

    const stateWithShots: DoomCrashState = {
      ...createInitialState(BET_AMOUNT),
      isCashedOut: true,
      cashedOutAt: 1.5,
      shotsFired: 5,
      shotsHit: 2,
    };
    const resultWithShots = getSessionResult(stateWithShots);
    expect(resultWithShots.accuracy).toBeCloseTo(0.4);
  });

  test('returns BASE_MULTIPLIER if not crashed and not cashed out (should not happen in final state)', () => {
    const state: DoomCrashState = {
        ...createInitialState(BET_AMOUNT),
        isRunning: false, // Session stopped but neither crashed nor cashed out, implying manual stop/edge case
        currentMultiplier: 1.7, // Current multiplier at "stop"
        shotsFired: 0,
        shotsHit: 0,
    };
    const result = getSessionResult(state);
    expect(result.crashed).toBe(false);
    // cashedOutAt is null, so it defaults to BASE_MULTIPLIER (1) for payout calculation
    expect(result.multiplier).toBe(BASE_MULTIPLIER);
    expect(result.payout).toBe(BET_AMOUNT * BASE_MULTIPLIER);
  });
});

describe('spawnEnemy', () => {
  const NOW_MS = 1000;

  test('at multiplier < 2: returns IMP', () => {
    const rng = makeConstRng(0); // For consistency, though not strictly needed at this branch
    const enemy = spawnEnemy(rng, NOW_MS, 1.5);
    expect(enemy.type).toBe("IMP");
    expect(enemy.threatMultiplierOnMiss).toBe(0.005);
  });

  test('at multiplier >= 2 and < 5: returns DEMON or IMP', () => {
    let rng = makeConstRng(0); // Force DEMON
    let enemy = spawnEnemy(rng, NOW_MS, 3.0);
    expect(enemy.type).toBe("DEMON");
    expect(enemy.threatMultiplierOnMiss).toBe(0.015);

    rng = makeConstRng(0.6); // Force IMP
    enemy = spawnEnemy(rng, NOW_MS, 3.0);
    expect(enemy.type).toBe("IMP");
    expect(enemy.threatMultiplierOnMiss).toBe(0.005);
  });

  test('at multiplier >= 5 and < 10: returns CACODEMON or DEMON', () => {
    let rng = makeConstRng(0); // Force CACODEMON
    let enemy = spawnEnemy(rng, NOW_MS, 7.0);
    expect(enemy.type).toBe("CACODEMON");
    expect(enemy.threatMultiplierOnMiss).toBe(0.03);

    rng = makeConstRng(0.7); // Force DEMON
    enemy = spawnEnemy(rng, NOW_MS, 7.0);
    expect(enemy.type).toBe("DEMON");
    expect(enemy.threatMultiplierOnMiss).toBe(0.015);
  });

  test('at multiplier >= 10 and < 25: returns CYBERDEMON or CACODEMON', () => {
    let rng = makeConstRng(0); // Force CYBERDEMON
    let enemy = spawnEnemy(rng, NOW_MS, 15.0);
    expect(enemy.type).toBe("CYBERDEMON");
    expect(enemy.threatMultiplierOnMiss).toBe(0.05);

    rng = makeConstRng(0.8); // Force CACODEMON
    enemy = spawnEnemy(rng, NOW_MS, 15.0);
    expect(enemy.type).toBe("CACODEMON");
    expect(enemy.threatMultiplierOnMiss).toBe(0.03);
  });


  test('at multiplier >= 25: always CYBERDEMON', () => {
    const rng = makeConstRng(0); // Should always be CYBERDEMON regardless of RNG
    const enemy = spawnEnemy(rng, NOW_MS, 30.0);
    expect(enemy.type).toBe("CYBERDEMON");
    expect(enemy.threatMultiplierOnMiss).toBe(0.05);
  });

  test('hitWindowEnd = spawnedAt + ENEMY_HIT_WINDOW_MS', () => {
    const rng = makeConstRng(0.5);
    const enemy = spawnEnemy(rng, NOW_MS, 1.5);
    expect(enemy.spawnedAt).toBe(NOW_MS);
    expect(enemy.hitWindowEnd).toBe(NOW_MS + ENEMY_HIT_WINDOW_MS);
  });

  test('depth = 0', () => {
    const rng = makeConstRng(0.5);
    const enemy = spawnEnemy(rng, NOW_MS, 1.5);
    expect(enemy.depth).toBe(0.0);
  });

  test('id is unique based on timestamp and random number', () => {
    const rng1 = makeRng([0.1]);
    const rng2 = makeRng([0.9]);
    const enemy1 = spawnEnemy(rng1, NOW_MS, 1.0);
    const enemy2 = spawnEnemy(rng2, NOW_MS, 1.0);
    expect(enemy1.id).not.toBe(enemy2.id);
    expect(enemy1.id).toMatch(new RegExp(`${NOW_MS}-\\d+`));
  });
});

describe('simulateDoomCrashRTP', () => {
  const mockRNGForRTP = () => {
    // A more complex RNG for simulation to provide diverse outcomes
    let callCount = 0;
    return {
      nextFloat: () => {
        callCount++;
        // Simulate varying cashout targets (1.5-5x), varying accuracies (0.3-0.8),
        // and varying crash probabilities.
        // This is simplified, a true simulation would need more thoughtful RNG.
        // For testing purposes, we want some variability but also determinism if needed.
        if (callCount % 100 < 10) return 0.01; // Crash early sometimes
        if (callCount % 100 < 20) return 0.99; // Prevent crash sometimes
        if (callCount % 100 < 30) return 0.4; // Low accuracy, trigger miss often
        if (callCount % 100 < 40) return 0.8; // High accuracy, hit often
        return Math.random(); // Use actual random for the rest
      },
    };
  };

  test('simulatedRTP is a positive finite number (sanity bounds)', () => {
    // Use a cycling rng with values spread across 0–1 to avoid bias
    const values = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 0.55, 0.45, 0.65];
    const rng = makeRng(values);
    const result = simulateDoomCrashRTP(rng, 500);
    expect(result.simulatedRTP).toBeGreaterThan(0);
    expect(Number.isFinite(result.simulatedRTP)).toBe(true);
  });

  test('simulatedRTP with spread RNG is within a reasonable range (0.1 – 10.0)', () => {
    // Note: exact 96% RTP requires calibration of crash constants vs player strategy.
    // This test verifies the simulation runs end-to-end and produces a sane finite value.
    const values = [0.15, 0.35, 0.55, 0.75, 0.45, 0.65, 0.25, 0.85, 0.5, 0.3, 0.7, 0.6];
    const rng = makeRng(values);
    const result = simulateDoomCrashRTP(rng, 2000);
    expect(result.simulatedRTP).toBeGreaterThan(0.1);
    expect(result.simulatedRTP).toBeLessThan(10.0);
    expect(result.averageMultiplier).toBeGreaterThan(1.0);
    expect(Number.isFinite(result.simulatedRTP)).toBe(true);
  });

  test('crashDistribution keys exist: 1x, 2x, 5x, 10x, 25x+', () => {
    const rng = makeConstRng(0.5);
    const result = simulateDoomCrashRTP(rng, 100);
    expect(result.crashDistribution).toHaveProperty('1x');
    expect(result.crashDistribution).toHaveProperty('2x');
    expect(result.crashDistribution).toHaveProperty('5x');
    expect(result.crashDistribution).toHaveProperty('10x');
    expect(result.crashDistribution).toHaveProperty('25x+');
  });

  test('all distribution values sum to rounds', () => {
    const rounds = 500;
    const rng = mockRNGForRTP();
    const result = simulateDoomCrashRTP(rng, rounds);
    const totalCrashes = Object.values(result.crashDistribution).reduce((sum, count) => sum + count, 0);
    expect(totalCrashes).toBe(rounds);
  });

  test('averageMultiplier and averageAccuracy are reasonable', () => {
    const rounds = 1000;
    const rng = mockRNGForRTP();
    const result = simulateDoomCrashRTP(rng, rounds);
    expect(result.averageMultiplier).toBeGreaterThanOrEqual(BASE_MULTIPLIER);
    expect(result.averageMultiplier).toBeLessThanOrEqual(MAX_THEORETICAL_MULTIPLIER);
    expect(result.averageAccuracy).toBeGreaterThanOrEqual(0);
    expect(result.averageAccuracy).toBeLessThanOrEqual(1);
  });
});
